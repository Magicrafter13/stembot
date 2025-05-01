import { EmbedBuilder, MessageFlags, parseEmoji, PermissionFlagsBits } from 'discord.js'; // Discord.js library - wrapper for Discord API
import emojiRegex from 'emoji-regex';
import { SlashCommandBuilder } from '@discordjs/builders';

const emojiTest = emojiRegex();

function setEmoji(interaction, reactor, role) {
	const emoji = interaction.options.getString("emoji", true);

	// Check if emoji string is valid
	const emojiObject = parseEmoji(emoji);
	if (!emojiObject.id && !(emojiTest.test(emojiObject.name) && emojiObject.name.match(emojiTest)[0] === emojiObject.name))
		return null;

	// Check if another role already uses this emoji
	if (reactor.roles.find(reactorRole => reactorRole.emoji === emoji)) {
		interaction.reply(`${emoji} is already being used by another role!`);
		return emojiObject;
	}

	// Update react-role message if one exists
	if (reactor.message && reactor.channel) {
		// Remove old emoji
		interaction.guild.channels.resolve(reactor.channel).messages.fetch(reactor.message)
		.then(message => {
			const oldReaction = message.reactions.cache.find(reaction => reaction.emoji.toString() === role.emoji);
			if (oldReaction)
				oldReaction.remove();
		})
		.catch(console.error);
	}

	// Update the role data
	role.emoji = emoji;
	return emojiObject;
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

	const channel = guild.channels.resolve(reactor.channel)
	return channel.messages.edit(reactor.message, { embeds: [ embed ] })
	.then(reactor.roles.filter(role => role.emoji).forEach(role => channel.messages.react(reactor.message, role.emoji)));
}

function deleteReactMessage(guild, reactor) {
	if (!reactor.message)
		return Promise.resolve();
	return guild.channels.resolve(reactor.channel).messages.fetch(reactor.message).then(message => message.delete());
}

function addRole(interaction, reactor) {
	const newRole = interaction.options.getRole("role", true);

	// Make sure it's not already in the list...
	if (reactor.roles.find(role => role.id === newRole.id))
		return interaction.reply(`${newRole} is already part of this react-role message!`);

	// Create the new role object
	const newObj = { id: newRole.id, emoji: null };

	// Set the emoji
	if (setEmoji(interaction, reactor, newObj) === null)
		return interaction.reply(`\`${interaction.options.getString('emoji', true)}\` cannot be resolved to a valid emoji!`)

	// Check if emoji was successfully added, or if it was already in use
	if (newObj.emoji) {
		reactor.roles.push(newObj);

		const promises = [interaction.reply(`${newRole} added to react-role message.`)];

		// Check if a react-role message exists, and update it
		if (reactor.message && reactor.channel)
			promises.push(editReactMessage(interaction.guild, reactor))

		return Promise.all(promises);
	}

	return interaction.reply(`${interaction.options.getString('emoji', true)} is already being used in this react-role message!`);
}

function removeRole(interaction, reactor) {
	const oldRole = interaction.options.getRole("role", true);

	// Make sure it's in the list...
	const checkRole = reactor.roles.find(role => role.id === oldRole.id);
	if (!checkRole)
		return interaction.reply(`${oldRole} is not part of this react-role message!`);

	// Delete the role
	reactor.roles.splice(reactor.roles.indexOf(checkRole), 1);

	// Check if a react-role message exists, and update it
	if (reactor.message && reactor.channel) {
		// Remove old emoji
		interaction.guild.channels.resolve(reactor.channel).messages.fetch(reactor.message)
		.then(msg => msg.reactions.cache.find(reaction => reaction.emoji.toString() === checkRole.emoji).remove())
		.catch(console.error);
		editReactMessage(interaction.guild, reactor);
	}

	return interaction.reply(`Removed ${oldRole} from react-role message.`);
}

function changeEmoji(interaction, reactor) {
	const role = interaction.options.getRole("role", true);

	// Get the reactor
	const obj = reactor.roles.find(reactorRole => reactorRole.id === role.id);
	if (!obj)
		return interaction.reply(`${reactor.name} doesn't have ${role}. Add it with \`/react add-role name:${reactor.name} role:${role} emoji:${interaction.options.getString("emoji", true)}\`!`);

	if (obj.emoji === interaction.options.getString("emoji", true))
		return interaction.reply(`${reactor.name} already uses ${obj.emoji}.`);

	// Set the emoji
	if (setEmoji(interaction, reactor, obj) === null)
		return interaction.reply(`\`${interaction.options.getString('emoji', true)}\` cannot be resolved to a valid emoji!`)

	if (reactor.channel && reactor.message)
		editReactMessage(interaction.guild, reactor);

	return interaction.reply(`Changed ${role} to ${obj.emoji}.`);
}

function createReactMessage(interaction, reactor) {
	const channel = interaction.options.getChannel("channel", true);

	// Delete previous react-role message if one exists
	deleteReactMessage(interaction.guild, reactor);

	return interaction.reply({ content: 'Generating embed...', flags: MessageFlags.Ephemeral })
	.then(() => {
		// Create message.
		channel.send({ content: '_ _', embeds: [ { title: 'Generating embed...' } ] })
		.then(message => message
			? () => {
				// Save message/channel id in reactor
				Object.assign(reactor, {
					message: message.id,
					channel: channel.id,
				});

				// Generate embed
				return editReactMessage(message.guild, reactor)
				.then(interaction.editReply(`Done! https://discord.com/channels/${interaction.guildId}/${channel.id}/${message.id}`))
				.catch(console.error);
			}
			: interaction.editReply("Failed to send message. Are you sure I have permissions in that channel?"))
	});
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

		const reactDB = interaction.client.settings.get('react');
		const manager = await reactDB.get(interaction.guildId)
		.then(data => data ? data : { reactors: [] })
		.catch(console.error);
		if (!manager)
			return interaction.reply({ content: "There was an error reading the database!", flags: MessageFlags.Ephemeral });
		if (!manager.reactors)
			manager.reactors = [];

		const name = interaction.options.getSubcommand() === "list" ? null : interaction.options.getString("name", true);
		const reactor = manager.reactors.find(searchReactor => searchReactor.name === name);

		const subcommand = interaction.options.getSubcommand();
		switch (subcommand) {
			// Send list of react-role message urls
			case 'list':
				return interaction.reply(`Here are the react-role messages currently in the database:\n${manager.reactors.map(printReactor => `${printReactor.name}: ${printReactor.channel && printReactor.message ? interaction.guild.channels.resolve(printReactor.channel).messages.resolve(printReactor.message).url : ''}`).join('\n')}`)
			case 'new': {
				if (reactor)
					return interaction.reply({ content: 'A react-role message with this name already exists!', flags: MessageFlags.Ephemeral });

				const newReactor = newReactorTemplate;
				newReactor.name = name;

				manager.reactors.push(newReactor);
				reactDB.set(interaction.guildId, manager);

				return interaction.reply(`Created new react-role data under '${name}'.`);
			}
			case 'delete':
				if (!reactor)
					return interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				// Remove from manager
				manager.reactors.splice(manager.reactors.indexOf(reactor), 1);
				interaction.reply(`Deleted '${name}' react-role data/message.`);

				// Delete react-role message if one exists, then remove from database
				return deleteReactMessage(interaction.guild, reactor)
				.then(reactDB.set(interaction.guildId, manager))
				.catch(error => {
					interaction.editReply("Failed to delete react-role message, database was not updated!");
					console.error(error);
				});
			case 'add-role':
				if (!reactor)
					return interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				// Try to add role to reactor.
				return addRole(interaction, reactor)
				.then(reactDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'remove-role':
				if (!reactor)
					return interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				// Try to remove role from reactor.
				return removeRole(interaction, reactor)
				.then(reactDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'change-emoji':
				if (!reactor)
					return interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				return changeEmoji(interaction, reactor)
				.then(reactDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'create-message': {
				if (!reactor)
					return interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				if (!reactor.roles.length)
					return interaction.reply(`This reactor is empty, add some roles to it first with:\n> /react add-role \`name:\` ${name}`);

				// Update the reactor (if applicable)
				const message = interaction.options.getString("message", false);
				if (message)
					reactor.text = message;

				// Create embed message
				return createReactMessage(interaction, reactor)
				.then(reactDB.set(interaction.guildId, manager)) // Update database
				.catch (console.error);
			}
			case 'set-text':
				if (!reactor)
					return interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				// Make sure there actually *is* a message to edit...
				if (!reactor.message)
					return interaction.reply(`You haven't made an embed yet. Create one with:\n> /react create-message \`name:\` ${name}`);

				// Update the reactor
				reactor.text = interaction.options.getString("message", true);

				// Update react-role message
				return editReactMessage(interaction.guild, reactor)
				.then(reactDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
		}

		throw new TypeError(`${subcommand} is not a valid subcommand!`);
	},
}
