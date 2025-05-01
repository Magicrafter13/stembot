import { EmbedBuilder, MessageFlags, parseEmoji, PermissionFlagsBits } from 'discord.js'; // Discord.js library - wrapper for Discord API
import emojiRegex from 'emoji-regex';
import { SlashCommandBuilder } from '@discordjs/builders';

const emojiTest = emojiRegex();

// Check if emoji string is valid - returns the input if it is, otherwise it returns null.
function emojiIsValid(string) {
	const emoji = parseEmoji(string);
	if (!emoji.id && !(emojiTest.test(emoji.name) && emoji.name.match(emojiTest)[0] === emoji.name))
		return null;
	return string;
}

function setEmoji(interaction, manager, data, emoji) {
	// Check if emoji already in use.
	if ((manager.fields ?? manager.classes).some(thing => thing.emoji === emoji))
		return false;

	const oldEmoji = data.emoji;

	// Get the reaction data from the previous emoji if it exists
	if (manager.reactor.channel && manager.reactor.message) {
		interaction.guild.channels.fetch(manager.reactor.channel)
		.then(channel => channel.messages.fetch(manager.reactor.message))
		.then(message => {
			const oldReaction = message.reactions.cache.find(reaction => reaction.emoji.name === oldEmoji);
			if (oldReaction)
				oldReaction.remove();
		})
		.catch(err => {
			console.error(err);
			interaction.channel.send({ content: 'Failed to remove reactions of the previous emoji!', flags: MessageFlags.Ephemeral });
		});
	}

	// Update field/class
	data.emoji = emoji;

	return true;
}

function editReactMessage(interaction, manager) {
	if (!manager.reactor.message)
		return Promise.reject(new Error('no message to edit'));

	// Check if 'manager' is from 'manager' or 'field'
	const isFieldManager = Boolean(manager.fields);

	const things = (isFieldManager
		? manager.fields
			.filter(field => field.emoji)
			.map(field => `${field.emoji} - ${interaction.guild.channels.resolve(field.channel).name} Classes`)
		: manager.classes
			.filter(fieldClass => fieldClass.emoji)
			.map(fieldClass => `${fieldClass.emoji} - ${manager.prefix} ${fieldClass.name}`)
	).join('\n');

	// The CLark College logo shall remain here until a new picture is found for the bot.
	// TODO: this ^
	const embed = new EmbedBuilder()
	.setColor(isFieldManager ? '#cc8800' : '#0099ff')
	.setTitle(isFieldManager
		? 'Roles for this server. (Fields)'
		: `Class Roles for ${interaction.guild.channels.resolve(manager.channel).name}`)
	.setAuthor({ name: 'STEM Bot', iconURL: 'https://www.clackamas.edu/images/default-source/logos/nwac/clark_college_300x300.png', url: 'https://gitlab.com/Magicrafter13/stembot' })
	.setDescription(manager.reactor.text)
	//.setThumbnail('link')
	.addFields({ name: isFieldManager ? 'Fields' : 'Classes', value: things === '' ? 'None set (use set-emoji).' : things })
	//.setImage('link')
	.setTimestamp()
	.setFooter({ text: 'Report bugs on our GitLab repository.' });

	const channel = interaction.guild.channels.resolve(manager.reactor.channel);
	return channel.messages.edit(manager.reactor.message, { content: '', embeds: [ embed ] })
	.then(Promise.all(
		(isFieldManager ? manager.fields : manager.classes).filter(info => info.emoji).map(info =>
			channel.messages.react(manager.reactor.message, info.emoji)
			.catch(error => {
				console.log(error);
				return interaction.followUp({ content: `Could not react with ${info.emoji}, is this a valid emoji?`, flags: MessageFlags.Ephemeral});
			})
		)
	))
	.catch(console.error);
}

function deleteMessage(guild, reactor) {
	return guild.channels.resolve(reactor.channel).messages.fetch(reactor.message)
	.then(message => message.delete())
	.catch(console.error);
}

function addClass(interaction, field) {
	// Get class from user
	const className = interaction.options.getString("name");

	// Make sure class is valid
	if (field.classes.find(classData => classData.name === className))
		return interaction.reply({ content: `Field already contains this class.`, flags: MessageFlags.Ephemeral });

	// Find matching role
	const classRole = interaction.guild.roles.cache.find(role => role.name.startsWith(`${field.prefix} ${className}`));
	if (!classRole)
		return interaction.reply({ content: `No role found with name \`${field.prefix} ${className}\`, you can create one by using \`create\` instead of \`add\`.`, flags: MessageFlags.Ephemeral });

	// Find matching channel
	const channel = interaction.guild.channels.cache.find(searchChannel => searchChannel.name.startsWith(`${field.prefix}${className}`.toLowerCase()) && searchChannel.isTextBased());
	if (!channel)
		return interaction.reply({ content: `No channel found with name \`${field.prefix}${className}\`, you can create one by using \`create:\` instead of \`add:\`.`, flags: MessageFlags.Ephemeral });

	// Get emoji from user, or null of none specified
	const emoji = interaction.options.getString("emoji", false);

	// Check if emoji string is valid
	if (emoji && !emojiIsValid(emoji))
		return interaction.reply(`\`${emoji}\` cannot be resolved to a valid emoji!`)

	// Add new class to field
	field.classes.push({
		name: className,
		role: classRole.id,
		channel: channel.id,
		emoji: emoji,
	});

	// Update embed message
	if (field.reactor.message && emoji)
		editReactMessage(interaction, field);

	return interaction.reply(`Added ${classRole.toString()} and ${channel.toString()} to ${interaction.guild.roles.resolve(field.id).toString()} field.${emoji ? ` Emoji: ${emoji}.` : ''}`);
}

function removeClass(interaction, field, fieldRole) {
	// Get class from user, then from the field
	const className = interaction.options.getString("name", true);
	const oldClass = field.classes.find(classData => classData.name === className);
	if (!oldClass)
		return interaction.reply({ content: `${fieldRole} doesn't contain this class.`, flags: MessageFlags.Ephemeral });

	// Update field
	field.classes.splice(field.classes.indexOf(oldClass), 1);

	const reply = `Removed \`${className}\` from list of classes.`;

	// Update embed message
	if (field.reactor.message)
		return editReactMessage(interaction, field).then(interaction.reply(reply));

	return interaction.reply(reply);
}

async function createClass(interaction, field) {
	// Get class from user
	const className = interaction.options.getString("name", true);
	if (field.classes.find(classData => classData.name === className))
		return interaction.reply({ content: `${field.toString()} already contains this class.`, flags: MessageFlags.Ephemeral });

	// Get emoji from user, null if none specified
	const emoji = interaction.options.getString("emoji", false);

	if (emoji) {
		// Check if emoji string is valid
		if (!emojiIsValid(emoji))
			return interaction.reply(`\`${emoji}\` cannot be resolved to a valid emoji!`)

		// Check if emoji is already in use
		if (field.classes.some(classData => classData.emoji === emoji))
			return interaction.reply({ content: 'This field already has a class with that emoji!', flags: MessageFlags.Ephemeral });
	}

	interaction.reply("Creating role.");

	// Create class role
	const classRole = await interaction.guild.roles.create({
		name: `${field.prefix} ${className}`,
		position: field.classes.length ? interaction.guild.roles.resolve(field.classes[field.classes.length - 1].role).position : null,
		reason: `${interaction.user.username} added class ${className} to ${field.prefix}.`,
	});

	// Create class channel
	const classChannel = await interaction.guild.channels.create(`${field.prefix}${className}`, {
		type: 'GUILD_TEXT',
		parent: interaction.guild.channels.resolve(field.channel),
		reason: `${interaction.user.username} added class ${className} to ${field.prefix}.`,
		position: field.classes.length ? interaction.guild.channels.resolve(field.classes[field.classes.length - 1].channel).position + 1 : null,
	});

	// Add class to field
	field.classes.push({
		name: className,
		role: classRole.id,
		channel: classChannel.id,
		emoji: emoji,
	});

	// Update embed message
	if (field.reactor.message && emoji)
		editReactMessage(interaction, field);

	// Keep user informed
	return interaction.editReply(`Added ${classRole.toString()} and ${classChannel.toString()} to ${interaction.guild.roles.resolve(field.id).toString()} info.${emoji ? ` Emoji: ${emoji}.` : ''}`);
}

function deleteClass(interaction, field, fieldRole) {
	// Get class from user, then from field
	const className = interaction.options.getString("name", true);
	const oldClass = field.classes.find(classData => classData.name === className);
	if (!oldClass)
		return interaction.reply({ content: `${fieldRole} doesn't contain this class.`, flags: MessageFlags.Ephemeral });

	return Promise.all([
		// Remove class from field
		removeClass(interaction, field, fieldRole),

		// Delete role
		interaction.guild.roles.resolve(oldClass.role).delete(`${interaction.user.username} deleted ${className} from ${field.prefix}.`)
		.then(interaction.followUp('Role deleted.'))
		.catch(console.error),

		// Delete channel (except not, because I'm still not sure I want the bot to have such power...)
		interaction.followUp(`You may now delete ${interaction.guild.channels.resolve(oldClass.channel).toString()}.`),
	]);
}

function createReactMessage(interaction, data) {
	const channel = interaction.options.getChannel("channel", true);
	if (!channel)
		return interaction.reply({ content: "Channel doesn't exist.", flags: MessageFlags.Ephemeral });

	// Delete previous react-role message if one exists
	if (data.reactor.message)
		deleteMessage(interaction.guild, data.reactor);

	return interaction.reply({ content: 'Generating embed...', flags: MessageFlags.Ephemeral })
	.then(
		// Create message.
		channel.send('Please wait while embed is generated...')
		.then(message => {
			// Save message/channel id in reactor
			data.reactor = {
				message: message.id,
				channel: channel.id,
				text: interaction.options.getString("message", false) ? interaction.options.getString("message", false) : data.reactor.text,
			};

			// Generate embed
			return editReactMessage(interaction, data)
			.then(interaction.editReply(`Done! Here's the new reaction embed: ${message.url}`))
			.catch(console.error);
		})
		.catch(console.error)
	);
}

function editReactorText(interaction, manager) {
	// Get new string from user's command, and update message.
	manager.reactor.text = interaction.options.getString("message", true);

	if (!manager.reactor.message)
		return interaction.reply('No react message to edit! Create one with `/catman create-message`.');

	// Update embed message
	return editReactMessage(interaction, manager)
	.then(interaction.reply('Message text updated.'))
	.catch(console.error);
}

function swapRoles(interaction, manager) {
	const role1 = interaction.options.getRole("role1", true);
	const role2 = interaction.options.getRole("role2", true);

	const data1 = manager.fields
		? manager.fields.find(field => field.id === role1.id)
		: manager.classes.find(classData => classData.role === role1.id);
	if (!data1)
		return interaction.reply({ content: manager.fields ? `${role1} is not a managed field role!` : `${role1} is not a class in this field!`, flags: MessageFlags.Ephemeral });
	const data2 = manager.fields
		? manager.fields.find(field => field.id === role2.id)
		: manager.classes.find(classData => classData.role === role2.id);
	if (!data2)
		return interaction.reply({ content: manager.fields ? `${role2} is not a managed field role!` : `${role2} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index1 = arr.indexOf(data1);
	const index2 = arr.indexOf(data2);
	[arr[index1], arr[index2]] = [arr[index2], arr[index1]];

	if (manager.fields)
		interaction.reply('Swapped fields.');
	else {
		const channel1 = interaction.guild.channels.resolve(data1.channel);
		const channel2 = interaction.guild.channels.resolve(data2.channel);

		const distance = Math.abs(index2 - index1);
		const pos1 = channel1.position;
		const pos2 = channel2.position;

		channel1.setPosition(pos2 - pos1 > 0 ? distance - 1 : -distance, { relative: true, reason: `${interaction.user.username} swapped 2 classes.` })
		.then(
			channel2.setPosition(pos2 - pos1 > 0 ? -distance : distance - 1, { relative: true, reason: `${interaction.user.username} swapped 2 classes.` })
			.then(interaction.reply('Classes/channels swapped.'))
			.catch(console.error)
		)
		.catch(console.error);
	}

	if (manager.reactor.message)
		editReactMessage(interaction, manager);

	return Promise.resolve();
}

function moveTop(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(classData => classData.role === role.id);

	if (!data)
		return interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	arr.splice(index, 1);
	arr.unshift(data);

	if (manager.fields)
		interaction.reply('Field moved to top.');
	else {
		interaction.guild.channels.resolve(data.channel).setPosition(-index, { relative: true, reason: `${interaction.user.username} moved class to top.` })
		.then(interaction.reply({ content: 'Class/channel moved to top.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}

	if (manager.reactor.message)
		editReactMessage(interaction, manager);

	return Promise.resolve();
}

function moveBottom(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(classData => classData.role === role.id);

	if (!data)
		return interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	arr.splice(index, 1);
	arr.push(data);

	if (manager.fields)
		interaction.reply({ content: 'Field moved to bottom.', flags: MessageFlags.Ephemeral });
	else {
		interaction.guild.channels.resolve(data.channel).setPosition(arr.length - index - 1, { relative: true, reason: `${interaction.user.username} moved class to bottom.` })
		.then(interaction.reply({ content: 'Class/channel moved to bottom.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}

	if (manager.reactor.message)
		editReactMessage(interaction, manager);

	return Promise.resolve();
}

function moveUp(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(classData => classData.role === role.id);

	if (!data)
		return interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	if (index < 1)
		return interaction.reply({ content: 'That channel is already at the top!', flags: MessageFlags.Ephemeral });
	[arr[index], arr[index - 1]] = [arr[index - 1], arr[index]];

	if (manager.fields)
		interaction.reply({ content: 'Field moved up.', flags: MessageFlags.Ephemeral });
	else {
		interaction.guild.channels.resolve(data.channel).setPosition(-1, { relative: true, reason: `${interaction.user.username} moved class up.` })
		.then(interaction.reply({ content: 'Class moved up.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}

	if (manager.reactor.message)
		editReactMessage(interaction, manager);

	return Promise.resolve();
}

function moveDown(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(classData => classData.role === role.id);

	if (!data)
		return interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	if (index === arr.length - 1)
		return interaction.reply({ content: 'That channel is already at the bottom!', flags: MessageFlags.Ephemeral });
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];

	if (manager.fields)
		interaction.reply({ content: 'Field moved down.', flags: MessageFlags.Ephemeral });
	else {
		interaction.guild.channels.resolve(data.channel).setPosition(1, { relative: true, reason: `${interaction.user.username} moved class down.` })
		.then(interaction.reply({ content: 'Class moved down.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}

	if (manager.reactor.message)
		editReactMessage(interaction, manager);

	return Promise.resolve();
}

const newReactor = {
	message: null,
	channel: null,
	text: 'React to this message for roles!',
};

const newFieldTemplate = {
	id: null,
	channel: null,
	prefix: null,
	emoji: null,
	reactor: newReactor,
	classes: [],
}

export default {
	data: new SlashCommandBuilder()
		.setName('catman')
		.setDescription('Manage Class Subjects/Fields')
		.addSubcommand(subcommand => subcommand
			.setName("list")
			.setDescription("Lists all fields currently stored in the manager."))
		.addSubcommand(subcommand => subcommand
			.setName("set-emoji")
			.setDescription("Change a field or class emoji.")
			.addStringOption(option => option
				.setName("emoji")
				.setDescription("Which emoji do you want to use?")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Which field do you want to change?")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("class")
				.setDescription("Which class do you want to change?")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("create-message")
			.setDescription("Generate a react-role embed.")
			.addChannelOption(option => option
				.setName("channel")
				.setDescription("Which channel do you want the message to be sent to?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("message")
				.setDescription("What should the embed say?")
				.setRequired(false))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Generate an embed for which field?")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("edit-message")
			.setDescription("Edit text of a react-role embed.")
			.addStringOption(option => option
				.setName("message")
				.setDescription("What should the embed say?")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Generate an embed for which field?")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("swap")
			.setDescription("Swap list order of fields/classes.")
			.addRoleOption(option => option
				.setName("role1")
				.setDescription("First thing to swap:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("role2")
				.setDescription("Second thing to swap:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Enter a field to swap classes in:")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("move-top")
			.setDescription("Move field/class to the top of the list.")
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Thing to move to the top:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Enter a field to move a class in:")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("move-bottom")
			.setDescription("Move field/class to the bottom of the list.")
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Thing to move to the bottom:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Enter a field to move a class in:")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("move-up")
			.setDescription("Move field/class up one position in the list.")
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Thing to move up:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Enter a field to move a class in:")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("move-down")
			.setDescription("Move field/class down one position in the list.")
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Thing to move down:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Enter a field to move a class in:")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("set-category")
			.setDescription("Set the channel category for a field. (Creates field if it doesn't exist.)")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field would you like to change?")
				.setRequired(true))
			.addChannelOption(option => option
				.setName("category")
				.setDescription("What channel category would you like to associate with this field?")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("set-prefix")
			.setDescription("Set the role/channel prefix for a field. (Creates field if it doesn't exist.)")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field would you like to change?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("prefix")
				.setDescription("What do roles/channels in this field start with?")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("print")
			.setDescription("Show information about a field.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field would you like to see?")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("add")
			.setDescription("Add an existing class role to a field.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field should this class be added to?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("name")
				.setDescription("What is the name/id of this class? (i.e. '120' from CS 120)")
				.setRequired(true))
			.addStringOption(option => option
				.setName("emoji")
				.setDescription("What emoji would you like to associate with this class?")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("create")
			.setDescription("Add a new class role to a field.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field should this class be added to?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("name")
				.setDescription("What is the name/id of this class? (i.e. '120' from CS 120)")
				.setRequired(true))
			.addStringOption(option => option
				.setName("emoji")
				.setDescription("What emoji would you like to associate with this class?")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("remove")
			.setDescription("Remove a class role from the field manager.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field do you want to remove a class from?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("name")
				.setDescription("What is the name/id of this class? (i.e. '120' from CS 120)")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("delete")
			.setDescription("Delete a class from the manager, and its role.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field do you want to delete a class from?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("name")
				.setDescription("What is the name/id of this class? (i.e. '120' from CS 120)")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("purge")
			.setDescription("Delete all data associated with a field from the manager.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field do you want to purge?")
				.setRequired(true))),
	guildOnly: true,
	cooldown: 0.5,
	// eslint-disable-next-line complexity
	async execute(interaction) {
		// Check if user has required permissions.
		if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles, { checkAdmin: true }))
			return interaction.reply({ content: 'You do not have adequate permissions for this command to work.\nRequires: MANAGE_CHANNELS and MANAGE_ROLES', flags: MessageFlags.Ephemeral });

		const fieldDB = interaction.client.settings.get('categories');
		let manager = await fieldDB.get(interaction.guildId)
		.then(data => data ? data : { fields: [], reactor: newReactor })
		.catch(console.error);
		/*if (!manager)
			return interaction.reply({ content: "There was an error reading the database!", flags: MessageFlags.Ephemeral });*/

		// Guild has version 3.0 data = upgrade to 4
		if (!manager.fields) {
			manager = {
				fields: manager,
				reactor: newReactor,
			};
		}

		const field = interaction.options.getRole("field");
		// TODO: figure out a way to make field a const
		let fieldInfo = field ? manager.fields.find(searchField => searchField.id === field.id) : null;
		if (fieldInfo) {
			/*
			 * Update field (when users have data from older version of bot)
			 * From Version 3
			 */
			if (!fieldInfo.reactor) {
				fieldInfo = {
					id: fieldInfo.id,
					channel: fieldInfo.channel,
					prefix: fieldInfo.prefix,
					emoji: null,
					reactor: newReactor,
					classes: (() => {
						const classes = [];
						for (let classNum = 0; classNum < fieldInfo.classes.length; ++classNum) {
							classes.push({
								name: fieldInfo.classes[classNum],
								role: fieldInfo.roles[classNum],
								channel: fieldInfo.channels[classNum],
								emoji: null,
							});
						}
						return classes;
					}) (),
				};
			}
		}
		const classRole = interaction.options.getRole("class");
		if (classRole && !field)
			return interaction.reply({ content: "You can't specify a class without a field!", flags: MessageFlags.Ephemeral });
		const classData = classRole ? fieldInfo.classes.find(searchClass => searchClass.role === classRole.id) : null;
		if (typeof classData === "undefined")
			return interaction.reply({ content: `${classRole} is not part of the ${field} field.`, flags: MessageFlags.Ephemeral }); // TODO also here

		// TODO: when a role is deleted from the server, if that triggers a client event, we should detect that and update the database, removing the data
		const subcommand = interaction.options.getSubcommand();
		switch (subcommand) {
			// List fields currently in manager.
			case 'list':
				return interaction.reply(
					`The following roles have field information:\n${
					manager.fields.map(fieldData => fieldData.id).forEach(snowflake =>
						interaction.guild.roles.resolve(snowflake)?.toString() ?? 'Could not resolve role!'
					).join('\n')}`);
			// Set field's emoji for react-role message.
			case 'set-emoji': {
				const emoji = emojiIsValid(interaction.options.getString('emoji', true));
				if (!emoji)
					return interaction.reply(`\`${interaction.options.getString('emoji', true)}\` cannot be resolved to a valid emoji!`);
				if (!setEmoji(interaction, classData ? fieldInfo : manager, classData ? classData : fieldInfo, emoji))
					return interaction.reply({ content: `That emoji is already in use by another ${classData ? 'class' : 'field'}!`, flags: MessageFlags.Ephemeral });
				// Update embed message
				if (manager.reactor.message)
					editReactMessage(interaction, classData ? fieldInfo : manager);
				return fieldDB.set(interaction.guildId, manager)
				.then(interaction.reply({ content: 'Reaction emoji updated.', flags: MessageFlags.Ephemeral }))
				.catch(console.error);
			}
			case 'create-message':
				if (field && !fieldInfo)
					return interaction.reply({ content: `No field information set for ${field.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(fieldInfo ? fieldInfo.classes : manager.fields).length)
					return interaction.reply({ content: `The ${fieldInfo ? "field" : "manager"} is empty, you need to add ${fieldInfo ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				// Create embed message
				console.log(`Creating ${fieldInfo ? "class" : "field"} react-role embed.`);
				return createReactMessage(interaction, fieldInfo ? fieldInfo : manager);
			// Edit text of react-role message.
			case 'edit-message':
				if (field && !fieldInfo)
					return interaction.reply({ content: `No field information set for ${field.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(fieldInfo ? fieldInfo.classes : manager.fields).length)
					return interaction.reply({ content: `The ${fieldInfo ? "field" : "manager"} is empty, you need to add ${fieldInfo ? "classes" : "fields"} first.\n> /catman add \`field:\` ${field} \`name:\` ...`, flags: MessageFlags.Ephemeral}); // TODO sample command
				// Make sure there actually *is* a message to edit...
				if (!(fieldInfo ? fieldInfo : manager).reactor.message)
					return interaction.reply({ content: `There is no message! Create one with:\n> /catman create-message \`channel:\` ... \`message:\` ${interaction.options.getString("message", false)} ${interaction.options.getRole("field", false) ? `\`field:\` ${interaction.options.getRole("field", false)}` : ""}`, flags: MessageFlags.Ephemeral });

				// Update reactor
				return editReactorText(interaction, fieldInfo ? fieldInfo : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			// Swap 2 field's position in list
			case 'swap':
				if (field && !fieldInfo)
					return interaction.reply({ content: `No field information set for ${field.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(fieldInfo ? fieldInfo.classes : manager.fields).length)
					return interaction.reply({ content: `The ${fieldInfo ? "field" : "manager"} is empty, you need to add ${fieldInfo ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				return swapRoles(interaction, fieldInfo ? fieldInfo : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			// Move field to top of list
			case 'move-top':
				if (field && !fieldInfo)
					return interaction.reply({ content: `No field information set for ${field.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(fieldInfo ? fieldInfo.classes : manager.fields).length)
					return interaction.reply({ content: `The ${fieldInfo ? "field" : "manager"} is empty, you need to add ${fieldInfo ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				return moveTop(interaction, fieldInfo ? fieldInfo : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			// Move field to bottom of list
			case 'move-bottom':
				if (field && !fieldInfo)
					return interaction.reply({ content: `No field information set for ${field.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(fieldInfo ? fieldInfo.classes : manager.fields).length)
					return interaction.reply({ content: `The ${fieldInfo ? "field" : "manager"} is empty, you need to add ${fieldInfo ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				return moveBottom(interaction, fieldInfo ? fieldInfo : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			// Move field up in list
			case 'move-up':
				if (field && !fieldInfo)
					return interaction.reply({ content: `No field information set for ${field.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(fieldInfo ? fieldInfo.classes : manager.fields).length)
					return interaction.reply({ content: `The ${fieldInfo ? "field" : "manager"} is empty, you need to add ${fieldInfo ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				return moveUp(interaction, fieldInfo ? fieldInfo : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			// Move field down in list
			case 'move-down':
				if (field && !fieldInfo)
					return interaction.reply({ content: `No field information set for ${field.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(fieldInfo ? fieldInfo.classes : manager.fields).length)
					return interaction.reply({ content: `The ${fieldInfo ? "field" : "manager"} is empty, you need to add ${fieldInfo ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				return moveDown(interaction, fieldInfo ? fieldInfo : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'set-category': {
				const category = interaction.options.getChannel("category", true);

				// Make sure user provided a valid category name
				if (!category.type === "GUILD_CATEGORY")
					return interaction.reply({ content: `${category} is not a channel category!`, flags: MessageFlags.Ephemeral });

				if (fieldInfo) {
					// Update existing field object's category
					fieldInfo.channel = category.id;

					// Update embed message
					if (fieldInfo.reactor.message)
						editReactMessage(interaction, fieldInfo);
					 // Update database
					return fieldDB.set(interaction.guildId, manager)
					.then(interaction.reply(`Updated field category to ${category.toString()}.`))
					.catch(console.error);
				}

				// Create new field object
				const newField = newFieldTemplate;

				// Set its role id
				newField.id = field.id;
				// Set its category
				newField.channel = category.id;

				// Add it to the manager
				manager.fields.push(newField);

				return interaction.reply(`Created field info for ${field}, under category ${category}.`);
			}
			case 'set-prefix': {
				// Get new field prefix from user
				const prefix = interaction.options.getString("prefix", true);

				if (fieldInfo) {
					// Update existing field object's prefix
					fieldInfo.prefix = prefix;

					// Update embed message
					if (fieldInfo.reactor.message)
						editReactMessage(interaction, fieldInfo);
					// Update database
					return fieldDB.set(interaction.guildId, manager)
					.then(interaction.reply({ content: `Updated field prefix to \`${prefix}\`.`, flags: MessageFlags.Ephemeral}))
					.catch(console.error);
				}

				// Create new field object
				const newField = newFieldTemplate;

				// Set its role id
				newField.id = field.id;
				// Set its prefix
				newField.prefix = prefix;

				// Add it to the manager
				manager.fields.push(newField);

				return interaction.reply(`Created field info for ${field}, with prefix \`${prefix}\`.`);
			}
			case 'print': {
				if (!fieldInfo)
					return interaction.reply({ content: `No field information set for ${field}`, flags: MessageFlags.Ephemeral });

				// TODO this is absolutely terrible, make an embed or something
				const lines = [];
				// Category
				if (fieldInfo.channel) {
					const category = await interaction.guild.channels.fetch(fieldInfo.channel).catch(console.error);
					lines.push(category ? `Channel Category: ${category.toString()}` : 'Could not fetch category!');
				}
				else
					lines.push("No Channel Category Set");
				// Prefix
				lines.push(fieldInfo.prefix ? `Prefix: ${fieldInfo.prefix}` : 'No Prefix Set');
				// React Role Embed
				if (fieldInfo.reactor.channel && fieldInfo.reactor.message) {
					const channel = await interaction.guild.channels.fetch(fieldInfo.reactor.channel).catch(console.error);
					lines.push(`React Role Message: ${channel ? await channel.messages.fetch(fieldInfo.reactor.message).catch(console.error)?.url ?? 'Could not fetch message!' : 'Could not fetch channel!'}`);
				}
				else
					lines.push("No React Role Message Created");
				// Classes
				lines.push(`Classes: [ ${fieldInfo.classes.map(classMap => classMap.name).join(', ')} ]`);
				// Roles
				lines.push(`Roles: [ ${fieldInfo.classes.map(classMap => interaction.guild.roles.resolve(classMap.role)?.toString ?? 'Could not fetch role!').join(', ')} ]`);
				// Channels
				lines.push(`Channels: [ ${fieldInfo.classes.map(classMap => interaction.guild.channels.resolve(classMap.channel)?.toString ?? 'Could not fetch channel!').join(', ')} ]`);
				lines.push(`Emoji: [ ${fieldInfo.classes.map(classMap => classMap.emoji).join(', ')} ]`);

				return interaction.reply(lines.join('\n'));
			}
			case 'add':
				if (!fieldInfo)
					return interaction.reply({ content: `No field information set for ${field}`, flags: MessageFlags.Ephemeral });
				if (!fieldInfo.channel)
					return interaction.reply({ content: `${field} has no channel category defined, please use \`/catman set-category field: ${field}\`.`, flags: MessageFlags.Ephemeral});
				if (!fieldInfo.prefix)
					return interaction.reply({ content: `${field} has no prefix defined, please use \`/catman set-prefix field: ${field}\`.`, flags: MessageFlags.Ephemeral });

				return addClass(interaction, fieldInfo, classRole)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'create':
				if (!fieldInfo)
					return interaction.reply({ content: `No field information set for ${field}`, flags: MessageFlags.Ephemeral });
				if (!fieldInfo.channel)
					return interaction.reply({ content: `${field} has no channel category defined, please use \`/catman set-category field: ${field}\`.`, flags: MessageFlags.Ephemeral});
				if (!fieldInfo.prefix)
					return interaction.reply({ content: `${field} has no prefix defined, please use \`/catman set-prefix field: ${field}\`.`, flags: MessageFlags.Ephemeral });

				return createClass(interaction, fieldInfo)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'remove':
				if (!fieldInfo)
					return interaction.reply({ content: `No field information set for ${field}`, flags: MessageFlags.Ephemeral });
				if (!fieldInfo.channel)
					return interaction.reply({ content: `${field} has no channel category defined, please use \`/catman set-category field: ${field}\`.`, flags: MessageFlags.Ephemeral});
				if (!fieldInfo.prefix)
					return interaction.reply({ content: `${field} has no prefix defined, please use \`/catman set-prefix field: ${field}\`.`, flags: MessageFlags.Ephemeral });

				return removeClass(interaction, fieldInfo, field);
			case 'delete':
				if (!fieldInfo)
					return interaction.reply({ content: `No field information set for ${field}`, flags: MessageFlags.Ephemeral });
				if (!fieldInfo.channel)
					return interaction.reply({ content: `${field} has no channel category defined, please use \`/catman set-category field: ${field}\`.`, flags: MessageFlags.Ephemeral});
				if (!fieldInfo.prefix)
					return interaction.reply({ content: `${field} has no prefix defined, please use \`/catman set-prefix field: ${field}\`.`, flags: MessageFlags.Ephemeral });

				return deleteClass(interaction, fieldInfo, field)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'purge':
				if (!fieldInfo)
					return interaction.reply({ content: `No field information set for ${field}`, flags: MessageFlags.Ephemeral });

				// Cleanup react-role message if one exists.
				if (fieldInfo.reactor.message)
					deleteMessage(interaction.guild, fieldInfo.reactor);

				// Update manager
				manager.fields.splice(manager.fields.indexOf(fieldInfo), 1);

				return interaction.reply(`${field} field no longer being managed.`);
		}
		fieldDB.set(interaction.guildId, manager); // Update database

		throw new TypeError(`${subcommand} is not a valid subcommand!`);
	},
}
