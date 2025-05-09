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
		.catch(error => {
			console.error(error);
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
	.then((isFieldManager ? manager.fields : manager.classes).filter(role => role.emoji).map(role => channel.messages.react(manager.reactor.message, role.emoji)));
}

function deleteMessage(guild, reactor) {
	if (!reactor.message)
		return Promise.resolve();
	return guild.channels.resolve(reactor.channel).messages.fetch(reactor.message).then(message => message.delete());
}

function addClass(interaction, field, classManager) {
	if (!classManager)
		return { success: false, reason: `No field information set for ${field}`, update: null };
	if (!classManager.channel)
		return { success: false, reason: `${field} has no channel category defined, please use \`/catman set-category field: ${field}\`.`, update: null };
	if (!classManager.prefix)
		return { success: false, reason: `${field} has no prefix defined, please use \`/catman set-prefix field: ${field}\`.`, update: null };

	// Get class from user
	const className = interaction.options.getString("name");

	// Make sure class is valid
	if (field.classes.find(classData => classData.name === className))
		return { success: false, reason: 'Field already contains this class.', update: null };

	// Find matching role
	const classRole = interaction.guild.roles.cache.find(role => role.name.startsWith(`${field.prefix} ${className}`));
	if (!classRole)
		return { success: false, reason: `No role found with name \`${field.prefix} ${className}\`, you can create one by using \`create\` instead of \`add\`.`, update: null };

	// Find matching channel
	const channel = interaction.guild.channels.cache.find(searchChannel => searchChannel.name.startsWith(`${field.prefix}${className}`.toLowerCase()) && searchChannel.isTextBased());
	if (!channel)
		return { success: false, reason: `No channel found with name \`${field.prefix}${className}\`, you can create one by using \`create:\` instead of \`add:\`.`, update: null };

	// Get emoji from user, or null of none specified
	const emoji = interaction.options.getString("emoji", false);

	// Check if emoji string is valid
	if (emoji && !emojiIsValid(emoji))
		return { success: false, reason: `\`${emoji}\` cannot be resolved to a valid emoji!`, update: null };

	// Add new class to field
	field.classes.push({
		name: className,
		role: classRole.id,
		channel: channel.id,
		emoji: emoji,
	});

	// Update embed message
	return {
		success: true,
		reason: `Added ${classRole.toString()} and ${channel.toString()} to ${interaction.guild.roles.resolve(field.id).toString()} field.${emoji ? ` Emoji: ${emoji}.` : ''}`,
		update: field.reactor.message && emoji ? editReactMessage(interaction, field) : Promise.resolve() };
}

function removeClass(interaction, classManager, field) {
	if (!classManager)
		return { success: false, reason: `No field information set for ${field}`, update: null };
	if (!classManager.channel)
		return { success: false, reason: `${field} has no channel category defined, please use \`/catman set-category field: ${field}\`.`, update: null };
	if (!classManager.prefix)
		return { success: false, reason: `${field} has no prefix defined, please use \`/catman set-prefix field: ${field}\`.`, update: null };

	// Get class from user, then from the field
	const className = interaction.options.getString("name", true);
	const oldClass = classManager.classes.find(classData => classData.name === className);
	if (!oldClass)
		return { success: false, reason: `${field} doesn't contain this class.`, update: null };

	// Update field
	classManager.classes.splice(classManager.classes.indexOf(oldClass), 1);

	// Update embed message
	return {
		success: true,
		reason: `Removed \`${className}\` from list of classes.`,
		update: classManager.reactor.message ? editReactMessage(interaction, classManager) : Promise.resolve() };
}

async function createClass(interaction, field, classManager) {
	if (!classManager)
		return { success: false, reason: `No field information set for ${field}`, update: null };
	if (!classManager.channel)
		return { success: false, reason: `${field} has no channel category defined, please use \`/catman set-category field: ${field}\`.`, update: null };
	if (!classManager.prefix)
		return { success: false, reason: `${field} has no prefix defined, please use \`/catman set-prefix field: ${field}\`.`, update: null };

	// Get class from user
	const className = interaction.options.getString("name", true);
	if (classManager.classes.find(classData => classData.name === className))
		return { success: false, reason: `${classManager.toString()} already contains this class.`, update: null };

	// Get emoji from user, null if none specified
	const emoji = interaction.options.getString("emoji", false);

	if (emoji) {
		// Check if emoji string is valid
		if (!emojiIsValid(emoji))
			return { success: false, reason: `\`${emoji}\` cannot be resolved to a valid emoji!`, update: null };

		// Check if emoji is already in use
		if (classManager.classes.some(classData => classData.emoji === emoji))
			return { success: false, reason: 'This field already has a class with that emoji!', update: null };
	}

	interaction.reply("Creating role.");

	// Create class role
	const classRole = await interaction.guild.roles.create({
		name: `${classManager.prefix} ${className}`,
		position: classManager.classes.length ? interaction.guild.roles.resolve(classManager.classes[classManager.classes.length - 1].role).position : null,
		reason: `${interaction.user.username} added class ${className} to ${classManager.prefix}.`,
	})
	.catch(error => {
		if (error.message !== "Missing Permissions")
			throw error;
	});
	if (!classRole)
		return { success: false, reason: 'Missing permissions to create role!', update: null };

	// Create class channel
	const classChannel = await interaction.guild.channels.create(`${classManager.prefix}${className}`, {
		type: 'GUILD_TEXT',
		parent: interaction.guild.channels.resolve(classManager.channel),
		reason: `${interaction.user.username} added class ${className} to ${classManager.prefix}.`,
		position: classManager.classes.length ? interaction.guild.channels.resolve(classManager.classes[classManager.classes.length - 1].channel).position + 1 : null,
	})
	.catch(error => {
		if (error.message !== "Missing Permissions")
			throw error;
	});
	if (!classChannel)
		return { success: false, reason: 'Missing permissions to create channel!', update: classRole.delete() };

	// Add class to field
	classManager.classes.push({
		name: className,
		role: classRole.id,
		channel: classChannel.id,
		emoji: emoji,
	});

	// Update embed message
	return {
		success: true,
		reason: `Added ${classRole.toString()} and ${classChannel.toString()} to ${interaction.guild.roles.resolve(classManager.id).toString()} info.${emoji ? ` Emoji: ${emoji}.` : ''}`,
		update: classManager.reactor.message && emoji ? editReactMessage(interaction, classManager) : Promise.resolve()
	};
}

function deleteClass(interaction, fieldInfo, field) {
	if (!fieldInfo)
		return { success: false, reason: `No field information set for ${field}`, update: null };
	if (!fieldInfo.channel)
		return { success: false, reason: `${field} has no channel category defined, please use \`/catman set-category field: ${field}\`.`, update: null };
	if (!fieldInfo.prefix)
		return { success: false, reason: `${field} has no prefix defined, please use \`/catman set-prefix field: ${field}\`.`, update: null };

	// Get class from user, then from field
	const className = interaction.options.getString("name", true);
	const oldClass = fieldInfo.classes.find(classData => classData.name === className);
	if (!oldClass)
		return { success: false, reason: `${field} doesn't contain this class.`, update: null };

	// Remove class from field
	const removeClassResult = removeClass(interaction, fieldInfo, field);
	if (!removeClassResult.success)
		return removeClassResult;

	return {
		success: true,
		reason: `Role deleted, channel now safe to delete: ${interaction.guild.channels.resolve(oldClass.channel).toString()}`,
		update: Promise.all([
			removeClassResult.update,
			// Delete role
			interaction.guild.roles.resolve(oldClass.role).delete(`${interaction.user.username} deleted ${className} from ${fieldInfo.prefix}.`),
			// Delete channel (except not, because I'm still not sure I want the bot to have such power...)
	]) };
}

async function createReactMessage(interaction, field, fieldManager, classManager) {
	if (field && !classManager)
		return { success: false, reason: `No field information set for ${field.toString()}`, update: null };
	if (!(classManager ? classManager.classes : fieldManager.fields).length) {
		return {
			success: false,
			reason: classManager
				? `The class manager is empty, you need to add classes first.\n> \`/catman add field:${field} name:postfix_class_name\``
				: `The field manager is empty, you need to add fields first.\n> \`/catman set-category field:${field} category:#some_category\``,
			update: null };
	}

	const manager = classManager ? classManager : fieldManager;

	const channel = interaction.options.getChannel("channel", true);
	if (!channel)
		return { success: false, reason: "Channel doesn't exist.", flags: MessageFlags.Ephemeral };

	// Delete previous react-role message if one exists
	const deletePromise = deleteMessage(interaction.guild, manager.reactor);

	const message = await channel.send({ content: '_ _', embeds: [ { title: 'Generating embed...' } ] }).catch(error => {
		if (error.message !== "Missing Permissions")
			throw error;
	});
	if (!message)
		return { success: false, reason: `Missing permisssions to send messages in ${channel}!`, update: null };

	// Save message/channel id in reactor
	manager.reactor = {
		message: message.id,
		channel: channel.id,
		text: interaction.options.getString("message", false) ?? manager.reactor.text,
	};

	// Generate embed
	return {
		success: true,
		reason: `Message generated! https://discord.com/channels/${interaction.guildId}/${manager.reactor.channel}/${manager.reactor.message}`,
		update: Promise.all([editReactMessage(interaction, manager), deletePromise]) };
}

function editReactorText(interaction, field, fieldManager, classManager) {
	if (field && !classManager)
		return { success: false, reason: `No field information set for ${field.toString()}`, update: null };
	if (!(classManager ? classManager.classes : fieldManager.fields).length)
		return { success: false, reason: `The ${classManager ? "field" : "manager"} is empty, you need to add ${classManager ? "classes" : "fields"} first.\n> /catman add \`field:\` ${field} \`name:\` ...`, update: null };

	const manager = classManager ? classManager : fieldManager;
	const message = interaction.options.getString("message", true);

	// Make sure there actually *is* a message to edit...
	if (!manager.reactor.message)
		return { success: false, reason: `There is no react message to edit! Create one with:\n> \`/catman create-message channel:#some_channel message:${message}${interaction.options.getRole("field", false) ? ` field:${interaction.options.getRole("field", false)}` : ""}\``, update: null };

	// Get new string from user's command, and update message.
	manager.reactor.text = message;

	// Update embed message
	return {
		success: true,
		reason: 'Message text updated.',
		update: editReactMessage(interaction, manager) };
}

function swapRoles(interaction, field, fieldManager, classManager) {
	if (field && !classManager)
		return { success: false, reason: `No field information set for ${field.toString()}`, update: null };
	if (!(classManager ? classManager.classes : fieldManager.fields).length)
		return { success: false, reason: `The ${classManager ? "field" : "manager"} is empty, you need to add ${classManager ? "classes" : "fields"} first.\n> `, update: null };

	const manager = classManager ? classManager : fieldManager;

	const role1 = interaction.options.getRole("role1", true);
	const role2 = interaction.options.getRole("role2", true);

	const data1 = manager.fields
		? manager.fields.find(searchField => searchField.id === role1.id)
		: manager.classes.find(classData => classData.role === role1.id);
	if (!data1)
		return { success: false, reason:`${role1} is not a managed field role!` , update: null };
	const data2 = manager.fields
		? manager.fields.find(searchField => searchField.id === role2.id)
		: manager.classes.find(classData => classData.role === role2.id);
	if (!data2)
		return { success: false, reason:`${role2} is not a managed field role!` , update: null };

	const arr = manager.fields ? manager.fields : manager.classes;
	const index1 = arr.indexOf(data1);
	const index2 = arr.indexOf(data2);
	[arr[index1], arr[index2]] = [arr[index2], arr[index1]];

	if (manager.fields)
		return { success: true, reason: '', update: Promise.resolve() };

	const channel1 = interaction.guild.channels.resolve(data1.channel);
	const channel2 = interaction.guild.channels.resolve(data2.channel);

	const distance = Math.abs(index2 - index1);
	const pos1 = channel1.position;
	const pos2 = channel2.position;

	return {
		success: true,
		reason: 'Swapped fields.',
		update: Promise.all([
			channel1.setPosition(pos2 - pos1 > 0 ? distance - 1 : -distance, { relative: true, reason: `${interaction.user.username} swapped 2 classes.` }),
			channel2.setPosition(pos2 - pos1 > 0 ? -distance : distance - 1, { relative: true, reason: `${interaction.user.username} swapped 2 classes.` }),
			editReactMessage(interaction, manager),
		]) };
}

function moveTop(interaction, field, fieldManager, classManager) {
	if (field && !classManager)
		return { success: false, reason: `No field information set for ${field.toString()}`, update: null };
	if (!(classManager ? classManager.classes : fieldManager.fields).length)
		return { success: false, reason: `The ${classManager ? "field" : "manager"} is empty, you need to add ${classManager ? "classes" : "fields"} first.\n> `, update: null };

	const manager = classManager ? classManager : fieldManager;

	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(searchField => searchField.id === role.id)
		: manager.classes.find(classData => classData.role === role.id);

	if (!data)
		return { success: false, reason:`${role} is not a managed field role!` , update: null };

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	arr.splice(index, 1);
	arr.unshift(data);

	if (manager.fields)
		return { success: true, reason: '', update: Promise.resolve() };

	return {
		success: true,
		reason: `${classManager ? "Class" : "Field"} moved to top.`,
		update: Promise.all([
			interaction.guild.channels.resolve(data.channel).setPosition(-index, { relative: true, reason: `${interaction.user.username} moved class to top.` }),
			manager.reactor.message ? editReactMessage(interaction, manager) : Promise.resolve(),
		]) };
}

function moveBottom(interaction, field, fieldManager, classManager) {
	if (field && !classManager)
		return { success: false, reason: `No field information set for ${field.toString()}`, update: null };
	if (!(classManager ? classManager.classes : fieldManager.fields).length)
		return { success: false, reason: `The ${classManager ? "field" : "manager"} is empty, you need to add ${classManager ? "classes" : "fields"} first.\n> `, update: null };

	const manager = classManager ? classManager : fieldManager;

	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(searchField => searchField.id === role.id)
		: manager.classes.find(classData => classData.role === role.id);

	if (!data)
		return { success: false, reason: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, update: null };

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	arr.splice(index, 1);
	arr.push(data);

	if (manager.fields)
		return { success: true, reason: '', flags: MessageFlags.Ephemeral };

	return {
		success: true,
		reason: `${classManager ? "Class" : "Field"} moved to bottom.`,
		update: Promise.all([
			interaction.guild.channels.resolve(data.channel).setPosition(arr.length - index - 1, { relative: true, reason: `${interaction.user.username} moved class to bottom.` }),
			manager.reactor.message ? editReactMessage(interaction, manager) : Promise.resolve(),
		]) };
}

function moveUp(interaction, field, fieldManager, classManager) {
	if (field && !classManager)
		return { success: false, reason: `No field information set for ${field.toString()}`, update: null };
	if (!(classManager ? classManager.classes : fieldManager.fields).length)
		return { success: false, reason: `The ${classManager ? "field" : "manager"} is empty, you need to add ${classManager ? "classes" : "fields"} first.\n> `, update: null };

	const manager = classManager ? classManager : fieldManager;

	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(searchField => searchField.id === role.id)
		: manager.classes.find(classData => classData.role === role.id);

	if (!data)
		return { success: false, reason: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, update: null };

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	if (index < 1)
		return { success: false, reason: 'That channel is already at the top!', update: null };

	[arr[index], arr[index - 1]] = [arr[index - 1], arr[index]];

	if (manager.fields)
		return { success: false, reason: '', update: null };

	return {
		success: true,
		reason: `${classManager ? "Class" : "Field"} moved up.`,
		update: Promise.all([
			interaction.guild.channels.resolve(data.channel).setPosition(-1, { relative: true, reason: `${interaction.user.username} moved class up.` }),
			manager.reactor.message ? editReactMessage(interaction, manager) : Promise.resolve(),
		]) };
}

function moveDown(interaction, field, fieldManager, classManager) {
	if (field && !classManager)
		return { success: false, reason: `No field information set for ${field.toString()}`, update: null };
	if (!(classManager ? classManager.classes : fieldManager.fields).length)
		return { success: false, reason: `The ${classManager ? "field" : "manager"} is empty, you need to add ${classManager ? "classes" : "fields"} first.\n> `, update: null };

	const manager = classManager ? classManager : fieldManager;

	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(searchField => searchField.id === role.id)
		: manager.classes.find(classData => classData.role === role.id);

	if (!data)
		return { success: false, reason: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, update: null };

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	if (index === arr.length - 1)
		return { success: false, reason: 'That channel is already at the top!', update: null };

	[arr[index], arr[index - 1]] = [arr[index - 1], arr[index]];

	if (manager.fields)
		return { success: false, reason: '', update: null };

	return {
		success: true,
		reason: `${classManager ? "Class" : "Field"} moved down.`,
		update: Promise.all([
			interaction.guild.channels.resolve(data.channel).setPosition(1, { relative: true, reason: `${interaction.user.username} moved class down.` }),
			manager.reactor.message ? editReactMessage(interaction, manager) : Promise.resolve(),
		]) };
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

		const fieldDB = await interaction.client.settings.get('categories');
		const fieldManager = await fieldDB.get(interaction.guildId)
		.then(manager => {
			if (!manager)
				return { fields: [], reactor: newReactor };
			// Upgrade guild data from v3 to v4
			if (!manager.fields) {
				return {
					fields: manager.map(fieldInfo => ({
						id: fieldInfo.id,
						channel: fieldInfo.channel,
						prefix: fieldInfo.prefix,
						emoji: null,
						reactor: newReactor,
						classes: fieldInfo.classes.map((name, index) => ({
							name,
							role: fieldInfo.roles[index],
							channel: fieldInfo.channels[index],
							emoji: null,
						})),
					})),
					reactor: newReactor,
				};
			}
			return manager;
		});

		const subcommand = interaction.options.getSubcommand();
		// Handle '/catman list' first
		if (subcommand === 'list') {
			return interaction.reply(
				`The following roles have field information:\n${
				fieldManager.fields.map(fieldData => fieldData.id).map(snowflake =>
					interaction.guild.roles.resolve(snowflake)?.toString() ?? 'Could not resolve role!'
				).join('\n')}`);
		}

		let reply = '';

		const field = interaction.options.getRole("field");
		const classRole = interaction.options.getRole("class");
		const classManager = field ? fieldManager.fields.find(searchField => searchField.id === field.id) : null;
		const classInfo = classRole ? classManager.classes.find(searchClass => searchClass.role === classRole.id) : null;

		if (classRole) {
			if (!field)
				return interaction.reply({ content: "You can't specify a class without a field!", flags: MessageFlags.Ephemeral });
			if (!classInfo)
				return interaction.reply({ content: `${classRole} is not part of the ${field} field.`, flags: MessageFlags.Ephemeral });
		}

		// TODO: when a role is deleted from the server, if that triggers a client event, we should detect that and update the database, removing the data

		switch (subcommand) {
			case 'create-message': {
				const { success, reason, update } = await createReactMessage(interaction, field, fieldManager, classManager);
				if (!success)
					return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
				await update.catch(error => {
					if (error.message !== "Missing Permissions")
						throw error;
					interaction.channel.send({ content: "Missing permissions to delete old react-role message, edit new react-role message, or add reactions to it!", flags: MessageFlags.Ephemeral });
				});
				reply = reason;
				break;
			}
			case 'edit-message': {
				const { success, reason, update } = editReactorText(interaction, field, fieldManager, classManager);
				if (!success)
					return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
				await update.catch(error => {
					if (error.message !== "Missing Permissions")
						throw error;
					interaction.channel.send({ content: "Missing permissions to edit react-role message!", flags: MessageFlags.Ephemeral });
				});
				reply = reason;
				break;
			}
			// Set field's emoji for react-role message.
			case 'set-emoji': {
				const emoji = interaction.options.getString('emoji', true);
				if (!emojiIsValid(emoji))
					return interaction.reply({ content: `\`${emoji}\` cannot be resolved to a valid emoji!`, flags: MessageFlags.Ephemeral });
				const manager = classInfo ? classManager : fieldManager;
				if (!setEmoji(interaction, manager, classInfo ? classInfo : classManager, emoji))
					return interaction.reply({ content: `That emoji is already in use by another ${classInfo ? 'class' : 'field'}!`, flags: MessageFlags.Ephemeral });

				reply = 'Reaction emoji updated.';

				// Update embed message
				if (fieldManager.reactor.message) {
					editReactMessage(interaction, manager)
					.catch(error => {
						if (error.message !== "Missing Permissions")
								throw error;
						reply += `\nUnable to update react role message due to the following error: {error.message}`;
					});
				}

				break;
			}
			// Swap 2 field's position in list
			case 'swap': {
				const { success, reason, update } = swapRoles(interaction, field, fieldManager, classManager);
				if (!success)
					return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
				await update.catch(error => {
					if (error.message !== "Missing Permissions")
						throw error;
					interaction.channel.send({ content: "Missing permissions to edit react-role message, or to move channels!", flags: MessageFlags.Ephemeral });
				})
				// Done
				reply = reason;
				break;
			}
			// Move field to top of list
			case 'move-top': {
				const { success, reason, update } = moveTop(interaction, field, fieldManager, classManager);
				if (!success)
					return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
				await update.catch(error => {
					if (error.message !== "Missing Permissions")
						throw error;
					interaction.channel.send({ content: "Missing permissions to move channel position!" });
				});
				reply = reason;
				break;
			}
			// Move field to bottom of list
			case 'move-bottom': {
				const { success, reason, update } = moveBottom(interaction, field, fieldManager, classManager);
				if (!success)
					return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
				await update.catch(error => {
					if (error.message !== "Missing Permissions")
						throw error;
					interaction.channel.send({ content: "Missing permissions to move channel position!" });
				});
				reply = reason;
				break;
			}
			// Move field up in list
			case 'move-up': {
				const { success, reason, update } = moveUp(interaction, field, fieldManager, classManager);
				if (!success)
					return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
				await update.catch(error => {
					if (error.message !== "Missing Permissions")
						throw error;
					interaction.channel.send({ content: "Missing permissions to move channel position!" });
				});
				reply = reason;
				break;
			}
			// Move field down in list
			case 'move-down': {
				const { success, reason, update } = moveDown(interaction, field, fieldManager, classManager);
				if (!success)
					return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
				await update.catch(error => {
					if (error.message !== "Missing Permissions")
						throw error;
					interaction.channel.send({ content: "Missing permissions to move channel position!" });
				});
				reply = reason;
				break;
			}
			case 'set-category': {
				const category = interaction.options.getChannel("category", true);

				// Make sure user provided a valid category name
				if (!category.type === "GUILD_CATEGORY")
					return interaction.reply({ content: `${category} is not a channel category!`, flags: MessageFlags.Ephemeral });

				if (classManager) {
					// Update existing field object's category
					classManager.channel = category.id;

					// Update embed message
					if (classManager.reactor.message) {
						editReactMessage(interaction, classManager)
						.catch(error => {
							if (error.message !== "Missing Permissions")
								throw error;
							interaction.channel.send({ content: "Missing permissions to edit react-role message!", flags: MessageFlags.Ephemeral });
						});
					}

					// Update database
					reply = `Updated field category to ${category.toString()}.`;
					break;
				}

				// Create new field object
				const newField = newFieldTemplate;

				// Set its role id
				newField.id = field.id;
				// Set its category
				newField.channel = category.id;

				// Add it to the manager
				fieldManager.fields.push(newField);

				reply = `Created field info for ${field}, under category ${category}.`;
				break;
			}
			case 'set-prefix': {
				// Get new field prefix from user
				const prefix = interaction.options.getString("prefix", true);

				if (classManager) {
					// Update existing field object's prefix
					classManager.prefix = prefix;

					// Update embed message
					if (classManager.reactor.message) {
						editReactMessage(interaction, classManager)
						.catch(error => {
							if (error.message !== "Missing Permissions")
								throw error;
							interaction.channel.send({ content: "Missing permissions to edit react-role message!", flags: MessageFlags.Ephemeral });
						})
					}

					// Update database
					reply = `Updated field prefix to \`${prefix}\`.`;
					break;
				}

				// Create new field object
				const newField = newFieldTemplate;

				// Set its role id
				newField.id = field.id;
				// Set its prefix
				newField.prefix = prefix;

				// Add it to the manager
				fieldManager.fields.push(newField);

				reply = `Created field info for ${field}, with prefix \`${prefix}\`.`;
				break;
			}
			case 'print': {
				if (!classManager)
					return interaction.reply({ content: `No field information set for ${field}`, flags: MessageFlags.Ephemeral });

				// TODO this is absolutely terrible, make an embed or something
				const lines = [];
				// Category
				if (classManager.channel) {
					const category = await interaction.guild.channels.fetch(classManager.channel).catch(console.error);
					lines.push(category ? `Channel Category: ${category.toString()}` : 'Could not fetch category!');
				}
				else
					lines.push("No Channel Category Set");
				// Prefix
				lines.push(classManager.prefix ? `Prefix: ${classManager.prefix}` : 'No Prefix Set');
				// React Role Embed
				if (classManager.reactor.channel && classManager.reactor.message) {
					const channel = await interaction.guild.channels.fetch(classManager.reactor.channel).catch(console.error);
					lines.push(`React Role Message: ${channel ? await channel.messages.fetch(classManager.reactor.message).catch(console.error)?.url ?? 'Could not fetch message!' : 'Could not fetch channel!'}`);
				}
				else
					lines.push("No React Role Message Created");
				// Classes
				lines.push(`Classes: [ ${classManager.classes.map(classMap => classMap.name).join(', ')} ]`);
				// Roles
				lines.push(`Roles: [ ${classManager.classes.map(classMap => interaction.guild.roles.resolve(classMap.role)?.toString() ?? 'Could not fetch role!').join(', ')} ]`);
				// Channels
				lines.push(`Channels: [ ${classManager.classes.map(classMap => interaction.guild.channels.resolve(classMap.channel)?.toString() ?? 'Could not fetch channel!').join(', ')} ]`);
				lines.push(`Emoji: [ ${classManager.classes.map(classMap => classMap.emoji).join(', ')} ]`);

				reply = lines.join('\n');
				break;
			}
			case 'add': {
				const { success, reason, update } = addClass(interaction, field, classManager);
				if (!success)
					return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
				await update.catch(error => {
					if (error.message !== "Missing Permissions")
						throw error;
					interaction.channel.send({ content: "Missing permissions to edit react-role message!", flags: MessageFlags.Ephemeral });
				});
				reply = reason;
				break;
			}
			case 'create': {
				const { success, reason, update } = await createClass(interaction, field, classManager);
				if (!success)
					return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
				await update.catch(error => {
					if (error.message !== "Missing Permissions")
						throw error;
					interaction.channel.send({ content: "Missing permissions to edit react-role message!", flags: MessageFlags.Ephemeral });
				});
				reply = reason;
				break;
			}
			case 'remove': {
				const { success, reason, update } = removeClass(interaction, classManager, field);
				if (!success)
					return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
				await update.catch(error => {
					if (error.message !== "Missing Permissions")
						throw error;
					interaction.channel.send({ content: "Missing permissions to edit react-role message!", flags: MessageFlags.Ephemeral });
				});
				reply = reason;
				break;
			}
			case 'delete': {
				const { success, reason, update } = deleteClass(interaction, classManager, field);
				if (!success)
					return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
				await update.catch(error => {
					if (error.message !== "Missing Permissions")
						throw error;
					interaction.channel.send({ content: "Missing permissions to edit react-role message!", flags: MessageFlags.Ephemeral });
				});
				reply = reason;
				break;
			}
			case 'purge':
				if (!classManager)
					return interaction.reply({ content: `No field information set for ${field}`, flags: MessageFlags.Ephemeral });

				// Cleanup react-role message if one exists.
				if (classManager.reactor.message) {
					deleteMessage(interaction.guild, classManager.reactor)
					.catch(error => {
						if (error.message !== "Missing Permissions")
							throw error;
						interaction.channel.send({ content: "Missing permissions to delete react role message!", flags: MessageFlags.Ephemeral });
					});
				}

				// Update manager
				fieldManager.fields.splice(fieldManager.fields.indexOf(classManager), 1);

				reply = `${field} field no longer being managed.`;
				break;
			default:
				throw new TypeError(`${subcommand} is not a valid subcommand!`);
		}

		// Save changes to database
		return fieldDB.set(interaction.guildId, fieldManager)
		.then(() => interaction.reply(reply))
		.catch(error => {
			interaction.channel.send("Failed to update database, changes were not saved!");
			console.error(error);
		})
	},
}
