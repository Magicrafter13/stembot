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

function setEmoji(interaction, reactor, roleInfo, emoji) {
	// Check if another role already uses this emoji
	if (reactor.roles.some(reactorRole => reactorRole.emoji === emoji))
		return { success: false, reason: `${emoji} is already being used by another role!`, update: null };

	// Update the role data
	const oldEmoji = roleInfo.emoji;
	roleInfo.emoji = emoji;

	return { success: true, reason: '', update: reactor.message && reactor.channel
		// Remove old emoji
		? interaction.guild.channels.fetch(reactor.channel)
			.then(channel => channel.messages.fetch(reactor.message))
			.then(message => message.reactions.cache.find(reaction => reaction.emoji.toString() === oldEmoji)?.remove())
			.catch(error => {
				console.error(error);
				interaction.channel.send({ content: 'Failed to remove reactions of the previous emoji!', flags: MessageFlags.Ephemeral });
			})
		: null
	};
}

function editReactMessage(guild, reactor) {
	// Get a text friendly list of roles
	const roles = reactor.roles.map(role => `${role.emoji} - ${guild.roles.resolve(role.id)}`).join('\n');

	const embed = new EmbedBuilder()
	.setColor('#ee3f20')
	.setTitle('Roles')
	.setAuthor({ name: 'Stembot', iconURL: 'https://www.clackamas.edu/images/default-source/logos/nwac/clark_college_300x300.png', url: 'https://gitlab.com/Magicrafter13/stembot' })
	.setDescription(reactor.text)
	//.setThumbnail('link')
	.addFields({ name: 'Roles:', value: reactor.roles.length ? roles : "None available (use --new)!" })
	//.setImage('link')
	.setTimestamp()
	.setFooter({ text: 'Report bugs on our GitLab repository.' });

	const channel = guild.channels.resolve(reactor.channel);
	return channel.messages.edit(reactor.message, { embeds: [ embed ] })
	.then(() => reactor.roles.filter(role => role.emoji).map(role => channel.messages.react(reactor.message, role.emoji)));
}

function deleteReactMessage(guild, reactor) {
	if (!reactor.message)
		return Promise.resolve();
	return guild.channels.resolve(reactor.channel).messages.fetch(reactor.message).then(message => message.delete());
}

function addRole(interaction, reactor, role, emoji) {
	// Make sure it's not already in the list...
	if (reactor.roles.some(searchRole => searchRole.id === role.id))
		return { success: false, reason: `${role} is already part of this react-role message!`, update: null }

	// Create the new role object
	const roleInfo = { id: role.id, emoji: null };

	// Check if emoji already in use, otherwise set it
	const setEmojiResult = setEmoji(interaction, reactor, roleInfo, emoji);
	if (!setEmojiResult.success)
		return setEmojiResult;

	reactor.roles.push(roleInfo);

	// Check if a react-role message exists, and update it
	return { success: true, reason: '', update: reactor.message && reactor.channel ? editReactMessage(interaction.guild, reactor) : Promise.resolve() };
}

function removeRole(interaction, reactor, role) {
	// Make sure it is in the list.
	const roleInfo = reactor.roles.find(searchRole => searchRole.id === role.id);
	if (!roleInfo)
		return { success: false, reason: `${role} is not part of this react-role message!`, update: null };

	// Delete the role
	reactor.roles.splice(reactor.roles.indexOf(roleInfo), 1);

	// Check if a react-role message exists, and update it
	return { success: true, reasons: '', update: reactor.message && reactor.channel
		? interaction.guild.channels.fetch(reactor.channel)
			.then(channel =>
				channel.messages.fetch(reactor.message)
				.then(message => message.reactions.cache.find(reaction => reaction.emoji.toString() === roleInfo.emoji).remove())
			)
			.then(() => editReactMessage(interaction.guild, reactor))
			.catch(console.error)
		: Promise.resolve()
	}
}

function changeEmoji(interaction, reactor, role, emoji) {
	// Check if role is part of this react-role manager.
	const roleInfo = reactor.roles.find(searchRole => searchRole.id === role.id);
	if (!roleInfo)
		return { success: false, reason: `${reactor.name} doesn't have ${role}. Add it with:\n> \`/react add-role name:${reactor.name} role:${role} emoji:${emoji}\`!`, update: null };
	// Check if role already uses this emoji.
	if (roleInfo.emoji === emoji)
		return { success: false, reason: `${role} already uses ${roleInfo.emoji}.`, update: null };
	// Set the emoji
	const setEmojiResult = setEmoji(interaction, reactor, roleInfo, emoji);
	if (!setEmojiResult.success)
		return setEmojiResult;

	return { success: true, reason: '', update: reactor.channel && reactor.message ? editReactMessage(interaction.guild, reactor) : Promise.resolve() };
}

async function createReactMessage(interaction, reactor) {
	// Ignore if no roles are added.
	if (!reactor.roles.length)
		return { success: false, reason: `This reactor is empty, add some roles to it first with:\n> \`/react add-role name:${reactor.name}\``, update: null };

	// Set reactor text (if applicable)
	const messageText = interaction.options.getString("message", false);
	if (messageText)
		reactor.text = messageText;

	const channel = interaction.options.getChannel("channel", true);

	// Delete previous react-role message if one exists
	const deletePromise = deleteReactMessage(interaction.guild, reactor);

	// Create message.
	const message = await channel.send({ content: '_ _', embeds: [ { title: 'Generating embed...' } ] }).catch(error => {
		if (error.message === "Missing Permissions")
			return null;
		throw error;
	});
	if (!message)
		return { success: false, reason: `Missing permissions to send messages in ${channel}!`, update: null };

	// Save message/channel id in reactor
	Object.assign(reactor, {
		message: message.id,
		channel: channel.id,
	});

	// Generate embed
	return { success: true, reason: '', update: Promise.all([editReactMessage(message.guild, reactor), deletePromise]) };
}

const newReactorTemplate = {
	name: null,
	message: null,
	channel: null,
	text: 'React to this message for roles!',
	roles: [],
};

export default {
	data: new SlashCommandBuilder()
		.setName('react')
		.setDescription('Create, Edit, and Delete react-role messages.')
		.addSubcommand(subcommand => subcommand
			.setName('list')
			.setDescription("List all reactors."))
		.addSubcommand(subcommand => subcommand
			.setName('new')
			.setDescription("Create a new reactor.")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Name of the new reactor:")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName('delete')
			.setDescription("Delete a reactor.")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Name of the existing reactor:")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName('add-role')
			.setDescription("Add a role to a reactor.")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Name of the existing reactor:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Role to add to the reactor:")
				.setRequired(true))
			.addStringOption(option => option
				.setName("emoji")
				.setDescription("Emoji to use in the reactor embed:")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("remove-role")
			.setDescription("Remove a role from a reactor.")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Name of the existing reactor:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Role to remove from the reactor:")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName('change-emoji')
			.setDescription("Add a role to a reactor.")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Name of the existing reactor:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Role to add to the reactor:")
				.setRequired(true))
			.addStringOption(option => option
				.setName("emoji")
				.setDescription("Emoji to use in the reactor embed:")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("create-message")
			.setDescription("Create a message embed for a reactor.")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Name of the existing reactor:")
				.setRequired(true))
			.addChannelOption(option => option
				.setName("channel")
				.setDescription("Channel to send the message in:")
				.setRequired(true))
			.addStringOption(option => option
				.setName("message")
				.setDescription("Custom message for the embed:")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("set-text")
			.setDescription("Change the custom message of an existing embed.")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Name of the existing reactor:")
				.setRequired(true))
			.addStringOption(option => option
				.setName("message")
				.setDescription("Custom message for the embed:")
				.setRequired(true))),
	guildOnly: true,
	cooldown: 0.5,
	async execute(interaction) {
		// Check if user has required permissions.
		if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles, { checkAdmin: true }))
			return interaction.reply({ content: 'You do not have adequate permissions for this command to work.\nRequires: MANAGE_ROLES', flags: MessageFlags.Ephemeral });

		const reactDB = await interaction.client.settings.get('react');
		const manager = await reactDB.get(interaction.guildId) ?? { reactors: [] };
		if (!manager.reactors)
			manager.reactors = [];

		// Handle '/react list' first
		const subcommand = interaction.options.getSubcommand();
		if (subcommand === 'list')
			return interaction.reply(`Here are the react-role messages currently in the database:\n${manager.reactors.map(reactor => `\`${reactor.name}\`: ${reactor.channel && reactor.message ? interaction.guild.channels.resolve(reactor.channel).messages.resolve(reactor.message).url : ''}`).join('\n')}`)

		const name = interaction.options.getString("name", true);
		const role = interaction.options.getRole("role", false);
		const emoji = interaction.options.getString("emoji", false);
		// Make sure emoji is valid (if one was passed)
		if (emoji && !emojiIsValid(emoji))
			return interaction.reply({ content: `\`${emoji}\` cannot be resolved to a valid emoji!`, flags: MessageFlags.Ephemeral });
		const reactor = manager.reactors.find(searchReactor => searchReactor.name === name);

		let reply = '';

		// Handle '/react new' next
		if (subcommand === 'new') {
			if (reactor)
				return interaction.reply({ content: 'A react-role message with this name already exists!', flags: MessageFlags.Ephemeral });

			manager.reactors.push({ ...newReactorTemplate, name });
			reply = `Created new react-role data under '${name}'.`;
		}
		else {
			// Make sure 'name' is valid
			if (!reactor)
				return interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> \`/react new name:${name}\``, flags: MessageFlags.Ephemeral });

			switch (subcommand) {
				case 'delete':
					// Delete react-role message if one exists, then remove from database
					deleteReactMessage(interaction.guild, reactor)
					.catch(error => {
						if (error.message !== "Missing Permissions")
							throw error;
						interaction.channel.send({ content: "Missing permissions to delete react-role message!", flags: MessageFlags.Ephemeral });
					});
					// Remove from manager
					manager.reactors.splice(manager.reactors.indexOf(reactor), 1);
					// Done
					reply = `Deleted '${name}' react-role data/message.`;
					break;
				case 'add-role': {
					// Try to add role to reactor.
					const { success, reason, update } = addRole(interaction, reactor, role, emoji);
					if (!success)
						return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
					await update.catch(error => {
						if (error.message !== "Missing Permissions")
							throw error;
						interaction.channel.send({ content: "Missing permissions to edit react-role message!", flags: MessageFlags.Ephemeral });
					});
					// Done
					reply = `Added ${role} to react-role message with emoji ${emoji}!`;
					break;
				}
				case 'remove-role': {
					// Remove role from reactor.
					const { success, reason, update } = removeRole(interaction, reactor, role);
					if (!success)
						return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
					await update.catch(error => {
						if (error.message !== "Missing Permissions")
							throw error;
						interaction.channel.send({ content: "Missing permissions to edit react-role message, or remove reactions from it!", flags: MessageFlags.Ephemeral });
					});
					// Done
					reply = `Removed ${role} from react-role message.`;
					break;
				}
				case 'change-emoji': {
					const { success, reason, update } = changeEmoji(interaction, reactor, role, emoji);
					if (!success)
						return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
					await update.catch(error => {
						if (error.message !== "Missing Permissions")
							throw error;
						interaction.channel.send({ content: "Missing permissions to edit react-role message, or remove reactions from it!", flags: MessageFlags.Ephemeral });
					});
					// Done
					reply = `Changed ${role} to ${emoji}.`;
					break;
				}
				case 'create-message': {
					const { success, reason, update } = createReactMessage(interaction, reactor);
					if (!success)
						return interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
					await update.catch(error => {
						if (error.message !== "Missing Permissions")
							throw error;
						interaction.channel.send({ content: "Missing permissions to delete old react-role message, edit new react-role message, or add reactions to it!", flags: MessageFlags.Ephemeral });
					});
					reply = `Message generated! https://discord.com/channels/${interaction.guildId}/${reactor.channel}/${reactor.message}`;
					break;
				}
				case 'set-text':
					// Make sure there actually *is* a message to edit...
					if (!reactor.message)
						return interaction.reply({ content: `You haven't made an embed yet. Create one with:\n> /react create-message \`name:\` ${name}`, flags: MessageFlags.Ephemeral });
					// Update the reactor
					reactor.text = interaction.options.getString("message", true);
					// Update react-role message
					await editReactMessage(interaction.guild, reactor);
					reply = 'Text updated.';
					break;
				default:
					throw new TypeError(`${subcommand} is not a valid subcommand! Don't forget to redeploy your slash commands after updating the bot!`);
			}
		}

		// Save changes to database
		return reactDB.set(interaction.guildId, manager)
		.then(() => interaction.reply(reply))
		.catch(error => {
			interaction.channel.send({ content: "Failed to update database, changes were not saved!" });
			console.error(error);
		});
	},
}
