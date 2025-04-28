const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js'); // Discord.js library - wrapper for Discord API

async function setEmoji(interaction, manager, data) {
	// Determine data type
	const type = manager.fields ? 'field' : 'class';

	// Get emoji from user
	const emoji = interaction.options.getString("emoji", true);

	// Check if emoji already in use.
	if ((type === 'field' ? manager.fields : manager.classes).find(thing => thing.emoji === emoji))
		return interaction.reply({ content: `That emoji is already in use by another ${type === 'field' ? 'field' : 'class'}!`, flags: MessageFlags.Ephemeral });

	const old_emoji = data.emoji;

	// Update field/class
	data.emoji = emoji;

	await interaction.reply({ content: 'Reaction emoji updated.', flags: MessageFlags.Ephemeral });

	// Get the reaction data from the previous emoji if it exists
	if (manager.reactor.channel && manager.reactor.message) {
		interaction.guild.channels.fetch(manager.reactor.channel)
			.then(channel => {
				channel.messages.fetch(manager.reactor.message)
					.then(message => {
						old_reaction = message.reactions.cache.find(reaction => reaction.emoji.name === old_emoji);
						if (old_reaction)
							old_reaction.remove();
						/*message.react(emoji).catch(error => {
							console.error(error);
							interaction.followUp({ content: 'Could not add reaction, are you sure you gave a valid emoji?', flags: MessageFlags.Ephemeral});
						});*/
					})
					.catch(error => {
						console.error(error);
						interaction.followUp({ content: 'Failed to fetch embed message, make sure I have the proper permissions for the channel!', flags: MessageFlags.Ephemeral});
					});
			})
			.catch(error => {
				console.error(error);
				interaction.followUp({ content: 'Failed to fetch channel containing embed message, make sure I have the proper permissions for the category/server!', flags: MessageFlags.Ephemeral});
			});
	}
}

async function addClass(interaction, field) {
	// Get class from user
	const class_name = interaction.options.getString("name");

	// Make sure class is valid
	if (field.classes.find(class_data => class_data.name === class_name))
		return await interaction.reply({ content: `Field already contains this class.`, flags: MessageFlags.Ephemeral });

	// Find matching role
	const class_role = interaction.guild.roles.cache.find(role => role.name.startsWith(`${field.prefix} ${class_name}`));
	if (!class_role)
		return await interaction.reply({ content: `No role found with name \`${field.prefix} ${class_name}\`, you can create one by using \`create\` instead of \`add\`.`, flags: MessageFlags.Ephemeral });

	// Find matching channel
	const channel = interaction.guild.channels.cache.find(channel => channel.name.startsWith(`${field.prefix}${class_name}`.toLowerCase()) && channel.isTextBased());
	if (!channel)
		return await interaction.reply({ content: `No channel found with name \`${field.prefix}${class_name}\`, you can create one by using \`create:\` instead of \`add:\`.`, flags: MessageFlags.Ephemeral });

	// Get emoji from user, or null of none specified
	const emoji = interaction.options.getString("emoji", false);

	// Add new class to field
	field.classes.push({
		name: class_name,
		role: class_role.id,
		channel: channel.id,
		emoji: emoji,
	});

	// Update embed message
	if (field.reactor.message && emoji)
		editReactMessage(interaction, field);

	return await interaction.reply(`Adding ${class_role.toString()} and ${channel.toString()} to ${interaction.guild.roles.resolve(field.id).toString()} field.${emoji ? ` Emoji: ${emoji}.` : ''}`);
}

async function removeClass(interaction, field, field_role) {
	// Get class from user, then from the field
	const class_name = interaction.options.getString("name", true);
	const old_class = field.classes.find(class_data => class_data.name === class_name);
	if (!old_class)
		return await interaction.reply({ content: `${field_role} doesn't contain this class.`, flags: MessageFlags.Ephemeral });

	// Update field
	field.classes.splice(field.classes.indexOf(old_class), 1);

	// Update embed message
	if (field.reactor.message)
		editReactMessage(interaction, field);

	return await interaction.reply(`Removed \`${class_name}\` from list of classes.`);
}

async function createClass(interaction, field) {
	// Get class from user
	const class_name = interaction.options.getString("name", true);
	if (field.classes.find(class_data => class_data.name === class_name))
		return await interaction.reply({ content: `${role.toString()} already contains this class.`, flags: MessageFlags.Ephemeral });

	// Get emoji from user, null if none specified
	emoji = interaction.options.getString("emoji", false);

	// Check if emoji is already in use
	if (emoji) {
		let alreadyInUse = false;
		field.classes.forEach(class_data => {
			if (class_data.emoji == emoji)
				return (alreadyInUse = true);
		});
		if (alreadyInUse)
			return interaction.reply({ content: 'This field already has a class with that emoji!', flags: MessageFlags.Ephemeral });
	}

	await interaction.reply("Creating role.");

	// Create class role
	const class_role = await interaction.guild.roles.create({
		name: `${field.prefix} ${class_name}`,
		position: field.classes.length ? interaction.guild.roles.resolve(field.classes[field.classes.length - 1].role).position : null,
		reason: `${interaction.user.username} added class ${class_name} to ${field.prefix}.`,
	});

	// Create class channel
	const class_channel = await interaction.guild.channels.create(`${field.prefix}${class_name}`, {
		type: 'GUILD_TEXT',
		parent: interaction.guild.channels.resolve(field.channel),
		reason: `${interaction.user.username} added class ${class_name} to ${field.prefix}.`,
		position: field.classes.length ? interaction.guild.channels.resolve(field.classes[field.classes.length - 1].channel).position + 1 : null,
	});

	// Move channel
	/*if (field.classes.length)
		class_channel.setPosition(message.guild.channels.resolve(field.classes[field.classes.length - 1].channel).rawPosition);*/

	// Add class to field
	field.classes.push({
		name: class_name,
		role: class_role.id,
		channel: class_channel.id,
		emoji: emoji,
	});

	// Update embed message
	if (field.reactor.message && emoji)
		editReactMessage(interaction, field);

	// Keep user informed
	return await interaction.editReply(`Added ${class_role.toString()} and ${class_channel.toString()} to ${interaction.guild.roles.resolve(field.id).toString()} info.${emoji ? ` Emoji: ${emoji}.` : ''}`);
}

async function deleteClass(interaction, field, field_role) {
	// Get class from user, then from field
	const class_name = interaction.options.getString("name", true);
	const old_class = field.classes.find(class_data => class_data.name === class_name);
	if (!old_class)
		return await interaction.reply({ content: `${field_role} doesn't contain this class.`, flags: MessageFlags.Ephemeral });

	// Remove class from field
	await removeClass(interaction, field, field_role);

	//await interaction.followUp(`${class_name} removed from ${field.prefix}.`);

	// Delete role
	interaction.guild.roles.resolve(old_class.role).delete(`${interaction.user.username} deleted ${class_name} from ${field.prefix}.`)
	.then(interaction.followUp('Role deleted.'))
	.catch(console.error);
	/*message.guild.channels.fetch(old_class.channel).delete(`${message.author.username} deleted ${class_name} from ${fieldData.prefix}.`)
	.then(message.channel.send('Channel deleted.'))
	.catch(console.error);*/
	// Delete channel (except not, because I'm still not sure I want the bot to have such power...)
	return await interaction.followUp(`You may now delete ${interaction.guild.channels.resolve(old_class.channel).toString()}.`);
}

async function createReactMessage(interaction, data) {
	const channel = interaction.options.getChannel("channel", true);
	if (!channel)
		return interaction.reply({ content: "Channel doesn't exist.", flags: MessageFlags.Ephemeral });

	// Delete previous react-role message if one exists
	if (data.reactor.message)
		deleteMessage(interaction.guild, data.reactor); //.catch(message.channel.send('WARNING: There was an error deleting the previous message.'));

	await interaction.reply({ content: 'Generating embed...', flags: MessageFlags.Ephemeral });

	// Create message.
	await channel.send('Please wait while embed is generated...')
		.then(message => {
			console.log("new message with id " + message.id);
			// Save message/channel id in reactor
			data.reactor = {
				message: message.id,
				channel: channel.id,
				text: interaction.options.getString("message", false) ? interaction.options.getString("message", false) : data.reactor.text,
			};

			// Generate embed
			editReactMessage(interaction, data)
			.then(interaction.editReply('Done!'))
			.catch(console.error);
		})
	.catch(console.error);
}

async function editReactorText(interaction, manager) {
	// Get new string from user's command, and update message.
	manager.reactor.text = interaction.options.getString("message", true);

	// Update embed message
	editReactMessage(interaction, manager)
	.then(interaction.reply('Message text updated.'))
	.catch(console.error);

	return;
}

async function editReactMessage(interaction, manager) {
	if (!manager.reactor.message)
		return;

	// Check if 'manager' is from 'manager' or 'field'
	const type = manager.fields ? 'manager' : 'field';

	const things = type === 'manager'
		? manager.fields
			.filter(field => field.emoji)
			.map(field => `${field.emoji} - ${interaction.guild.channels.resolve(field.channel).name} Classes`)
			.join('\n')
		: manager.classes
			.filter(field_class => field_class.emoji)
			.map(field_class => `${field_class.emoji} - ${manager.prefix} ${field_class.name}`)
			.join('\n');

	// The CLark College logo shall remain here until a new picture is found for the bot.
	// TODO: this ^
	const embed = new EmbedBuilder()
	.setColor(type === 'manager' ? '#cc8800' : '#0099ff')
	.setTitle(type === 'manager'
		? 'Roles for this server. (Fields)'
		: `Class Roles for ${interaction.guild.channels.resolve(manager.channel).name}`)
	.setAuthor({ name: 'STEM Bot', iconURL: 'https://www.clackamas.edu/images/default-source/logos/nwac/clark_college_300x300.png', url: 'https://gitlab.com/Magicrafter13/stembot' })
	.setDescription(manager.reactor.text)
	//.setThumbnail('link')
	.addFields({ name: type === 'manager' ? 'Fields' : 'Classes', value: things === '' ? 'None set (use set-emoji).' : things })
	//.setImage('link')
	.setTimestamp()
	.setFooter({ text: 'Report bugs on our GitLab repository.' });

	const channel = interaction.guild.channels.resolve(manager.reactor.channel);
	channel.messages.edit(manager.reactor.message, { content: '', embeds: [ embed ] })
		.then(() => {
			(type === 'manager' ? manager.fields : manager.classes).forEach(t => {
				if (t.emoji)
					channel.messages.react(manager.reactor.message, t.emoji)
						.catch(error => {
							console.log(error);
							interaction.followUp({ content: `Could not react with ${t.emoji}, is this a valid emoji?`, flags: MessageFlags.Ephemeral});
						});
			});
		})
	.catch(console.error);
	return;
}

async function deleteMessage(guild, reactor) {
	guild.channels.resolve(reactor.channel).messages.fetch(reactor.message)
	.then(m => m.delete())
	.catch(console.error);
}

async function swapRoles(interaction, manager) {
	const role1 = interaction.options.getRole("role1", true);
	const role2 = interaction.options.getRole("role2", true);

	const data1 = manager.fields
		? manager.fields.find(field => field.id === role1.id)
		: manager.classes.find(class_data => class_data.role === role1.id);
	if (!data1)
		return await interaction.reply({ content: manager.fields ? `${role1} is not a managed field role!` : `${role1} is not a class in this field!`, flags: MessageFlags.Ephemeral });
	const data2 = manager.fields
		? manager.fields.find(field => field.id === role2.id)
		: manager.classes.find(class_data => class_data.role === role2.id);
	if (!data2)
		return await interaction.reply({ content: manager.fields ? `${role2} is not a managed field role!` : `${role2} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index1 = arr.indexOf(data1);
	const index2 = arr.indexOf(data2);
	[arr[index1], arr[index2]] = [arr[index2], arr[index1]];

	if (!manager.fields) {
		const channel1 = interaction.guild.channels.resolve(data1.channel);
		const channel2 = interaction.guild.channels.resolve(data2.channel);

		const distance = Math.abs(index2 - index1);
		const pos1 = channel1.position;
		const pos2 = channel2.position;

		channel1.setPosition(pos2 - pos1 > 0 ? distance - 1 : -distance, { relative: true, reason: `${interaction.user.username} swapped 2 classes.` })
		.then(() => {
			channel2.setPosition(pos2 - pos1 > 0 ? -distance : distance - 1, { relative: true, reason: `${interaction.user.username} swapped 2 classes.` })
			.then(interaction.reply('Classes/channels swapped.'))
			.catch(console.error);
		})
		.catch(console.error);
	}
	else interaction.reply('Swapped fields.');

	return editReactMessage(interaction, manager);
}

async function moveTop(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(class_data => class_data.role === role.id);

	if (!data)
		return await interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	arr.splice(index, 1);
	arr.unshift(data);

	if (!manager.fields) {
		const channel = interaction.guild.channels.resolve(data.channel);
		channel.setPosition(-index, { relative: true, reason: `${interaction.user.username} moved class to top.` })
		.then(interaction.reply({ content: 'Class/channel moved to top.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}
	else interaction.reply('Field moved to top.');

	return editReactMessage(interaction, manager);
}

async function moveBottom(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(class_data => class_data.role === role.id);

	if (!data)
		return await interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	arr.splice(index, 1);
	arr.push(data);

	if (!manager.fields) {
		const channel = interaction.guild.channels.resolve(data.channel);
		channel.setPosition(arr.length - index - 1, { relative: true, reason: `${interaction.user.username} moved class to bottom.` })
		.then(interaction.reply({ content: 'Class/channel moved to bottom.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}
	else interaction.reply({ content: 'Field moved to bottom.', flags: MessageFlags.Ephemeral });

	return editReactMessage(interaction, manager);
}

async function moveUp(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(class_data => class_data.role === role.id);

	if (!data)
		return await interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	if (index < 1)
		return interaction.reply({ content: 'That channel is already at the top!', flags: MessageFlags.Ephemeral });
	[arr[index], arr[index - 1]] = [arr[index - 1], arr[index]];

	if (!manager.fields) {
		const channel = interaction.guild.channels.resolve(data.channel);
		channel.setPosition(-1, { relative: true, reason: `${interaction.user.username} moved class up.` })
		.then(interaction.reply({ content: 'Class moved up.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}
	else interaction.reply({ content: 'Field moved up.', flags: MessageFlags.Ephemeral });

	return editReactMessage(interaction, manager);
}

async function moveDown(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(class_data => class_data.role === role.id);

	if (!data)
		return await interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	if (index == arr.length - 1)
		return interaction.reply({ content: 'That channel is already at the bottom!', flags: MessageFlags.Ephemeral });
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];

	if (!manager.fields) {
		const channel = interaction.guild.channels.resolve(data.channel);
		channel.setPosition(1, { relative: true, reason: `${interaction.user.username} moved class down.` })
		.then(interaction.reply({ content: 'Class moved down.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}
	else interaction.reply({ content: 'Field moved down.', flags: MessageFlags.Ephemeral });

	return editReactMessage(interaction, manager);
}

const newReactor = {
	message: null,
	channel: null,
	text: 'React to this message for roles!',
};

const newField = {
	id: null,
	channel: null,
	prefix: null,
	emoji: null,
	reactor: newReactor,
	classes: [],
}

module.exports = {
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
	async execute(interaction) {
		// Check if user has required permissions.
		if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles, { checkAdmin: true }))
			return await interaction.reply({ content: 'You do not have adequate permissions for this command to work.\nRequires: MANAGE_CHANNELS and MANAGE_ROLES', flags: MessageFlags.Ephemeral });

		const fieldDB = interaction.client.settings.get('categories');
		let manager = await fieldDB.get(interaction.guildId)
		.then(manager => manager ? manager : { fields: [], reactor: newReactor })
		.catch(console.error);
		if (!manager)
			return await interaction.reply({ content: "There was an error reading the database!", flags: MessageFlags.Ephemeral });

		// Guild has version 3.0 data = upgrade to 4
		if (!manager.fields) {
			manager = {
				fields: manager,
				reactor: newReactor,
			};
		}

		const field_role = interaction.options.getRole("field");
		// TODO figure out a way to make field a const
		let field = field_role ? manager.fields.find(field => field.id === field_role.id) : null;
		/*if (field === undefined)
			return await interaction.reply(`${field_role} is not currently stored in the manager. Add it with:\n>`); // TODO: easier way to add fields than current implementation...*/
		if (field) {
			/*
			 * Update field (when users have data from older version of bot)
			 * From Version 3
			 */
			if (!field.reactor) {
				field = {
					id: field.id,
					channel: field.channel,
					prefix: field.prefix,
					emoji: null,
					reactor: newReactor,
					classes: (() => {
						let classes = [];
						for (let i = 0; i < field.classes.length; i++) {
							classes.push({
								name: field.classes[i],
								role: field.roles[i],
								channel: field.channels[i],
								emoji: null,
							});
						}
						return classes;
					}) (),
				};
			}
		}
		const class_role = interaction.options.getRole("class");
		if (class_role && !field_role)
			return await interaction.reply({ content: "You can't specify a class without a field!", flags: MessageFlags.Ephemeral });
		const class_data = class_role ? field.classes.find(c => c.role === class_role.id) : null;
		if (class_data === undefined)
			return await interaction.reply({ content: `${class_role} is not part of the ${field_role} field.`, flags: MessageFlags.Ephemeral }); // TODO also here

		switch (interaction.options.getSubcommand()) {
			// List fields currently in manager.
			case 'list': {
				let message = `The following roles have field information:\n`;
				manager.fields.map(f => f.id).forEach(snowflake => {
					const role = interaction.guild.roles.resolve(snowflake);
					message += `${(role ? role.toString() : 'Could not resolve role!')}\n`
				});
				return await interaction.reply(message);
				return await interaction.reply(`The following roles have field information:\n${manager.fields.map(f => interaction.guild.roles.cache.find(r => r.id === f.id).toString()).join('\n')}`);
			}
			// Set field's emoji for react-role message.
			case 'set-emoji':
				/*if (class_role)
				field = manager.fields.find(field => field.id === role.id);*/
				setEmoji(interaction, class_data ? field : manager, class_data ? class_data : field)
					.then(() => {
						// Update embed message
						editReactMessage(interaction, class_data ? field : manager)
						.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
						.catch(console.error);
					})
				.catch(console.error);

				break;
			case 'create-message':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				// Create embed message
				console.log(`Creating ${field ? "class" : "field"} react-role embed.`);
				await createReactMessage(interaction, field ? field : manager);

				break;
			// Edit text of react-role message.
			case 'edit-message':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> /catman add \`field:\` ${field_role} \`name:\` ...`, flags: MessageFlags.Ephemeral}); // TODO sample command
				// Make sure there actually *is* a message to edit...
				if (!(field ? field : manager).reactor.message)
					return await interaction.reply({ content: `There is no message! Create one with:\n> /catman create-message \`channel:\` ... \`message:\` ${interaction.options.getString("message", false)} ${interaction.options.getRole("field", false) ? `\`field:\` ${interaction.options.getRole("field", false)}` : ""}`, flags: MessageFlags.Ephemeral });

				// Update reactor
				editReactorText(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);

				break;
			// Swap 2 field's position in list
			case 'swap':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				swapRoles(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
				break;
			// Move field to top of list
			case 'move-top':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				moveTop(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
				break;
			// Move field to bottom of list
			case 'move-bottom':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				moveBottom(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
				break;
			// Move field up in list
			case 'move-up':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				moveUp(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
				break;
			// Move field down in list
			case 'move-down':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				moveDown(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
				break;
			case 'set-category':
				const category = interaction.options.getChannel("category", true);

				// Make sure user provided a valid category name
				if (!category.type === "GUILD_CATEGORY")
					return await interaction.reply({ content: `${category} is not a channel category!`, flags: MessageFlags.Ephemeral });

				if (field) {
					// Update existing field object's category
					field.channel = category.id;

					// Update embed message
					editReactMessage(interaction, field)
					.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
					.catch(console.error);

					return await interaction.reply(`Updated field category to ${category.toString()}.`);
				}

				// Create new field object
				field = newField;

				// Set its role id
				field.id = field_role.id;
				// Set its category
				field.channel = category.id;

				// Add it to the manager
				manager.fields.push(field);

				interaction.reply(`Created field info for ${field_role}, under category ${category}.`);
				break;
			case 'set-prefix':
				// Get new field prefix from user
				const prefix = interaction.options.getString("prefix", true);

				if (field) {
					// Update existing field object's prefix
					field.prefix = prefix;

					// Update embed message
					editReactMessage(interaction, field)
					.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
					.catch(console.error);

					return await interaction.reply({ content: `Updated field prefix to \`${prefix}\`.`, flags: MessageFlags.Ephemeral});
				}

				// Create new field object
				field = newField;

				// Set its role id
				field.id = role.id;
				// Set its prefix
				field.prefix = prefix;

				// Add it to the manager
				manager.fields.push(field);

				interaction.reply(`Created field info for ${field_role}, with prefix \`${prefix}\`.`);
				break;
			case 'print':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });

				// TODO this is absolutely terrible, make an embed or something
				let message = "";
				if (field.channel) {
					const category = await interaction.guild.channels.fetch(field.channel).catch(console.error);
					message += category ? `Channel Category: ${category.toString()}` : 'Could not fetch category!';
				}
				else message += "No Channel Category Set";
				message += `\n${field.prefix ? `Prefix: ${field.prefix}` : 'No Prefix Set'}\n`;
				if (field.reactor.channel && field.reactor.message) {
					message += "React Role Message: ";
					const channel = await interaction.guild.channels.fetch(field.reactor.channel).catch(console.error);
					if (channel) {
						const embed = await channel.messages.fetch(field.reactor.message).catch(console.error);
						message += embed ? embed.url : 'Could not fetch message!';
					}
					else message += 'Could not fetch channel!';
				}
				else message += "No React Role Message Created";
				message += `\nClasses: [ ${field.classes.map(c => c.name).join(', ')} ]\nRoles: [ `;
				let first = true;
				field.classes.map(c => c.role).forEach(snowflake => {
					if (first)
						first = false;
					else
						message += ', ';
					const role = interaction.guild.roles.resolve(snowflake);
					message += role ? role.toString() : 'Could not fetch role!';
				});
				message += ` ]\nChannels: [ `;
				first = true;
				field.classes.map(c => c.channel).forEach(snowflake => {
					if (first)
						first = false;
					else
						message += ', ';
					const channel = interaction.guild.channels.resolve(snowflake);
					message += channel ? channel.toString() : 'Could not fetch channel!';
				});
				message += ` ]\nEmoji: [ ${field.classes.map(c => c.emoji).join(', ')} ]`;

				return await interaction.reply(message);
			case 'add':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });
				if (!field.channel)
					return await interaction.reply({ content: `${field_role} has no channel category defined, please use \`/catman set-category field: ${field_role}\`.`, flags: MessageFlags.Ephemeral});
				if (!field.prefix)
					return await interaction.reply({ content: `${field_role} has no prefix defined, please use \`/catman set-prefix field: ${field_role}\`.`, flags: MessageFlags.Ephemeral });

				return addClass(interaction, field, class_role)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'create':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });
				if (!field.channel)
					return await interaction.reply({ content: `${field_role} has no channel category defined, please use \`/catman set-category field: ${field_role}\`.`, flags: MessageFlags.Ephemeral});
				if (!field.prefix)
					return await interaction.reply({ content: `${field_role} has no prefix defined, please use \`/catman set-prefix field: ${field_role}\`.`, flags: MessageFlags.Ephemeral });

				return createClass(interaction, field)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'remove':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });
				if (!field.channel)
					return await interaction.reply({ content: `${field_role} has no channel category defined, please use \`/catman set-category field: ${field_role}\`.`, flags: MessageFlags.Ephemeral});
				if (!field.prefix)
					return await interaction.reply({ content: `${field_role} has no prefix defined, please use \`/catman set-prefix field: ${field_role}\`.`, flags: MessageFlags.Ephemeral });

				await removeClass(interaction, field, field_role);

				break;
			case 'delete':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });
				if (!field.channel)
					return await interaction.reply({ content: `${field_role} has no channel category defined, please use \`/catman set-category field: ${field_role}\`.`, flags: MessageFlags.Ephemeral});
				if (!field.prefix)
					return await interaction.reply({ content: `${field_role} has no prefix defined, please use \`/catman set-prefix field: ${field_role}\`.`, flags: MessageFlags.Ephemeral });

				return deleteClass(interaction, field, field_role)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'purge':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });

				// Cleanup react-role message if one exists.
				if (field.reactor.message)
					deleteMessage(interaction.guild, field.reactor); //.catch(message.channel.send('WARNING: There was an error deleting the previous message.'));

				// Update manager
				manager.fields.splice(manager.fields.indexOf(field), 1);

				await interaction.reply(`${field_role} field no longer being managed.`);
				break;
		}
		fieldDB.set(interaction.guildId, manager); // Update database
	},
}
