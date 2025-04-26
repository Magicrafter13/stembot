const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js'); // Discord.js library - wrapper for Discord API

async function addRole(interaction, reactor) {
	const new_role = interaction.options.getRole("role", true);

	// Make sure it's not already in the list...
	if (reactor.roles.find(role => role.id === new_role.id))
		return await interaction.reply(`${new_role} is already part of this react-role message!`);

	// Create the new role object
	const new_obj = { id: new_role.id, emoji: null };

	// Set the emoji
	await setEmoji(interaction, reactor, new_obj);

	// Check if emoji was successfully added, or if it was already in use
	if (new_obj.emoji) {
		reactor.roles.push(new_obj);
		await interaction.reply(`${new_role} added to react-role message.`);

		// Check if a react-role message exists, and update it
		if (reactor.message && reactor.channel)
			editReactMessage(interaction.guild, reactor);
	}
}

/*async function old_addRole(message, reactor, args) {
	if (!args.length)
		return message.channel.send('Missing argument, requires a role.');

	// Extract role's unique snowflake from message
	const snowflake = args.shift().replace(/^<@&(\d+)>$/, `$1`);
	const new_role = message.guild.roles.resolve(snowflake);

	// Make sure it's valid
	if (!new_role)
		return message.channel.send(`Could not resolve \`${snowflake}\` to a valid role!`);

	// Make sure it's not already in the list...
	const check_role = reactor.roles.find(role => role.id === new_role.id);
	if (check_role)
		return message.channel.send(`${new_role} is already part of this react-role message!`);

	// Create the new role object
	const new_obj = { id: new_role.id, emoji: null };

	// Set the emoji
	await old_setEmoji(message, reactor, new_obj, args);

	// Check if emoji was successfully added, or if it was already in use
	if (new_obj.emoji) {
		reactor.roles.push(new_obj);
		message.channel.send(`${new_role} added to react-role message.`);

		// Check if a react-role message exists, and update it
		if (reactor.message && reactor.channel)
			editReactMessage(message.guild, reactor);
	}
}*/

async function removeRole(interaction, reactor) {
	const old_role = interaction.options.getRole("role", true);

	// Make sure it's in the list...
	const check_role = reactor.roles.find(role => role.id === old_role.id);
	if (!check_role)
		return await interaction.reply(`${old_role} is not part of this react-role message!`);

	// Delete the role
	reactor.roles.splice(reactor.roles.indexOf(check_role), 1);

	// Check if a react-role message exists, and update it
	if (reactor.message && reactor.channel) {
		// Remove old emoji
		interaction.guild.channels.resolve(reactor.channel).messages.fetch(reactor.message)
		.then(msg => msg.reactions.cache.find(reaction => reaction.emoji.toString() === check_role.emoji).remove())
		.catch(console.error);
		editReactMessage(interaction.guild, reactor);
	}

	return await interaction.reply(`Removed ${old_role} from react-role message.`);
}

/*async function old_removeRole(message, reactor, args) {
	if (!args.length)
		return message.channel.send('Missing argument, requires a role.');

	// Extract role's unique snowflake from message
	const snowflake = args.shift().replace(/^<@&(\d+)>$/, `$1`);
	const new_role = message.guild.roles.resolve(snowflake);

	// Make sure it's valid
	if (!new_role)
		return message.channel.send(`Could not resolve \`${snowflake}\` to a valid role!`);

	// Make sure it's in the list...
	const check_role = reactor.roles.find(role => role.id === new_role.id);
	if (!check_role)
		return message.channel.send(`${new_role} is not part of this react-role message!`);

	// Delete the role
	reactor.roles.splice(reactor.roles.indexOf(check_role), 1);

	// Check if a react-role message exists, and update it
	if (reactor.message && reactor.channel) {
		// Remove old emoji
		message.guild.channels.resolve(reactor.channel).messages.fetch(reactor.message)
		.then(msg => msg.reactions.cache.find(reaction => reaction.emoji.toString() === check_role.emoji).remove())
		.catch(console.error);
		editReactMessage(message.guild, reactor);
	}
}*/

async function changeEmoji(interaction, reactor) {
	const role = interaction.options.getRole("role", true);

	// Get the reactor
	const obj = reactor.roles.find(r_role => r_role.id === role.id);
	if (!obj)
		return await interaction.reply(`${reactor.name} doesn't have ${role}. Add it with \`/react add-role name:${reactor.name} role:${role} emoji:${interaction.options.getString("emoji", true)}\`!`);

	if (obj.emoji === interaction.options.getString("emoji", true))
		return await interaction.reply(`${reactor.name} already uses ${obj.emoji}.`);

	// Set the emoji
	await setEmoji(interaction, reactor, obj);
	await interaction.reply(`Changed ${role} to ${obj.emoji}.`);

	if (reactor.channel && reactor.message)
		editReactMessage(interaction.guild, reactor);
}

/*async function old_changeEmoji(message, reactor, args) {
	if (!args.length)
		return message.channel.send('Missing argument, requires a role.');

	// Extract role's unique snowflake from message
	const snowflake = args.shift().replace(/^<@&(\d+)>$/, `$1`);
	const role = message.guild.roles.resolve(snowflake);

	// Make sure it's valid
	if (!role)
		return message.channel.send(`Could not resolve \`${snowflake}\` to a valid role!`);

	// Get the reactor
	const obj = reactor.roles.find(r_role => r_role.id === role.id);

	// Set the emoji
	old_setEmoji(message, reactor, obj, args)
		.then(() => {
			if (reactor.channel && reactor.message)
				editReactMessage(message.guild, reactor);
		})
	.catch(console.error);
}*/

async function setEmoji(interaction, reactor, role) {
	const emoji = interaction.options.getString("emoji", true);

	// Check if another role already uses this emoji
	if (reactor.roles.find(r_role => r_role.emoji === emoji))
		return await interaction.reply(`${emoji} is already being used by another role!`);

	// Update react-role message if one exists
	if (reactor.message && reactor.channel) {
		// Remove old emoji
		interaction.guild.channels.resolve(reactor.channel).messages.fetch(reactor.message)
			.then(message => {
				const old_reaction = message.reactions.cache.find(reaction => reaction.emoji.toString() === role.emoji);
				if (old_reaction)
					old_reaction.remove();
			})
		.catch(console.error);
	}
	// Update the role data
	role.emoji = emoji;
}

/*async function old_setEmoji(message, reactor, role, args) {
	if (!args.length)
		return message.channel.send('Missing argument, requires an emoji.');

	// Get the new emoji
	const emoji = args.shift();

	// Check if another role already uses this emoji
	const check_role = reactor.roles.find(r_role => r_role.emoji === emoji);
	if (check_role)
		return message.channel.send(`${emoji} is already being used by another role!`);

	// Update react-role message if one exists
	if (reactor.message && reactor.channel) {
		// Remove old emoji
		const msg = await message.guild.channels.resolve(reactor.channel).messages.fetch(reactor.message);
		try {
			msg.reactions.cache.find(reaction => reaction.emoji.toString() === role.emoji).remove();
		}
		catch (e) {
			//message.channel.send('Uh...');
		}
	}
	// Update the emoji
	role.emoji = emoji;
}*/

async function createReactMessage(interaction, reactor) {
	const channel = interaction.options.getChannel("channel", true);

	// Delete previous react-role message if one exists
	await deleteReactMessage(interaction.guild, reactor);

	await interaction.reply({ content: 'Generating embed...', flags: MessageFlags.Ephemeral });

	// Create message.
	const message = await channel.send({ content: '_ _', embeds: [ { title: 'Generating embed...' } ] });
	if (!message)
		return await interaction.editReply("Failed to send message. Are you sure I have permissions in that channel?");

	// Save message/channel id in reactor
	reactor.message = message.id;
	reactor.channel = channel.id;

	// Generate embed
	editReactMessage(message.guild, reactor)
	.then(interaction.editReply(`Done! https://discord.com/channels/${interaction.guildId}/${channel.id}/${message.id}`))
	.catch(console.error);
}

/*async function old_createReactMessage(message, reactor, args) {
	if (!args.length)
		return message.channel.send('Missing argument, requires a channel.');

	// Extract channel's unique snowflake from message
	const snowflake = args.shift().replace(/^<#(\d+)>$/, `$1`);
	const channel = message.guild.channels.resolve(snowflake);

	// See if we were given a valid snowflake
	if (!channel)
		return message.channel.send(`Could not resolve \`${snowflake}\` to a valid channel!`);

	// Delete previous react-role message if one exists
	await deleteReactMessage(message.guild, reactor);

	// Create message.
	const embed_message = await channel.send({ content: '_ _', embeds: [ { title: 'Generating embed...' } ] });

	// Save message/channel id in reactor
	reactor.message = embed_message.id;
	reactor.channel = channel.id;

	// Generate embed
	return editReactMessage(message.guild, reactor).catch(console.error);
}*/

async function deleteReactMessage(guild, reactor) {
	if (reactor.message) {
		guild.channels.resolve(reactor.channel).messages.fetch(reactor.message)
		.then(m => m.delete())
		.catch(console.error);
	}
}
async function editReactMessage(guild, reactor) {
	// TODO: remove this
	if (!reactor.message)
		return;

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
	channel.messages.edit(reactor.message, { embeds: [ embed ] })
		.then(() => {
			reactor.roles.forEach(role => {
				if (role.emoji)
					channel.messages.react(reactor.message, role.emoji);
			});
		})
	.catch(console.error);
	return;
}


const newReactor = {
	name: null,
	message: null,
	channel: null,
	text: 'React to this message for roles!',
	roles: [],
};

module.exports = {
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
			return await interaction.reply({ content: 'You do not have adequate permissions for this command to work.\nRequires: MANAGE_ROLES', flags: MessageFlags.Ephemeral });

		const reactDB = interaction.client.settings.get('react');
		let manager = await reactDB.get(interaction.guildId)
		.then(manager => manager ? manager : { reactors: [] })
		.catch(console.error);
		if (!manager)
			return await interaction.reply({ content: "There was an error reading the database!", flags: MessageFlags.Ephemeral });
		if (!manager.reactors)
			manager.reactors = [];

		const name = interaction.options.getSubcommand() === "list" ? null : interaction.options.getString("name", true);
		const reactor = manager.reactors.find(reactor => reactor.name === name);

		switch (interaction.options.getSubcommand()) {
			// Send list of react-role message urls
			case 'list':
				return await interaction.reply(`Here are the react-role messages currently in the database:\n${manager.reactors.map(reactor => `${reactor.name}: ${reactor.channel && reactor.message ? interaction.guild.channels.resolve(reactor.channel).messages.resolve(reactor.message).url : ''}`).join('\n')}`)
			case 'new':
				if (reactor)
					return await interaction.reply({ content: 'A react-role message with this name already exists!', flags: MessageFlags.Ephemeral });

				const new_reactor = newReactor;
				new_reactor.name = name;

				manager.reactors.push(new_reactor);
				reactDB.set(interaction.guildId, manager);

				return await interaction.reply(`Created new react-role data under '${name}'.`);
			case 'delete':
				if (!reactor)
					return await interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				// Remove from manager
				manager.reactors.splice(manager.reactors.indexOf(reactor), 1);
				await interaction.reply(`Deleted '${name}' react-role data/message.`);

				// Delete react-role message if one exists
				deleteReactMessage(interaction.guild, reactor)
				.then(() => reactDB.set(interaction.guildId, manager))
					.catch(error => {
						interaction.editReply("Failed to delete react-role message, database was not updated!");
						console.error(error);
					});
				break;
			case 'add-role':
				if (!reactor)
					return await interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				// Try to add role to reactor.
				addRole(interaction, reactor)
				.then(() => reactDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);

				break;
			case 'remove-role':
				if (!reactor)
					return await interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				// Try to remove role from reactor.
				removeRole(interaction, reactor)
				.then(() => reactDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);

				break;
			case 'change-emoji':
				if (!reactor)
					return await interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				changeEmoji(interaction, reactor)
				.then(() => reactDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
				break;
			case 'create-message':
				if (!reactor)
					return await interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				if (!reactor.roles.length)
					return await interaction.reply(`This reactor is empty, add some roles to it first with:\n> /react add-role \`name:\` ${name}`);

				// Update the reactor (if applicable)
				const message = interaction.options.getString("message", false);
				if (message)
					reactor.text = message;

				// Create embed message
				createReactMessage(interaction, reactor)
				.then(() => reactDB.set(interaction.guildId, manager)) // Update database
				.catch (console.error);

				break;
			case 'set-text':
				if (!reactor)
					return await interaction.reply({ content: `No reactor with the name \`${name}\` exists. Create one with:\n> /react new \`name:\` ${name}`, flags: MessageFlags.Ephemeral });

				// Make sure there actually *is* a message to edit...
				if (!reactor.message)
					return await interaction.reply(`You haven't made an embed yet. Create one with:\n> /react create-message \`name:\` ${name}`);

				// Update the reactor
				reactor.text = interaction.options.getString("message", true);

				// Update react-role message
				editReactMessage(interaction.guild, reactor)
				.then(() => reactDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);

				break;
		}
	},
	/*argsMin: 1,
	argsMax: -1,
	old_execute(message, args, settings) {
		// Check if user has required permissions.
		const guildMember = message.guild.members.cache.get(message.author.id);
		if (!guildMember.permissions.has(PermissionFlagsBits.ManageRoles, { checkAdmin: true }))
			return message.reply('You do not have adequate permissions for this command to work.\nRequires: MANAGE_ROLES');

		const reactDB = settings.get('react');
		reactDB.get(message.guild.id)
			.then(async function (val) {
				let manager;

				// Guild has no data in database yet
				if (!val) {
					manager = {
						reactors: []
					};
				}
				else {
					manager = val;
				}

				const command = args.shift();
				const name = args.shift();

				const reactor = manager.reactors.find(reactor => reactor.name === name);

				switch (command) {
					// Send list of react-role message urls
					case '-l': case '--list':
						return message.channel.send(`Here are the react-role messages currently in the database:\n${manager.reactors.map(reactor => `${reactor.name}: ${reactor.channel && reactor.message ? message.guild.channels.resolve(reactor.channel).messages.resolve(reactor.message).url : ''}`).join('\n')}`);
					case '-n': case '--new':
						if (!name)
							return message.channel.send('Missing argument, requires name.');

						if (reactor)
							return message.channel.send('A react-role message with this name already exists!');

						const new_reactor = newReactor;
						new_reactor.name = name;

						manager.reactors.push(new_reactor);
						reactDB.set(message.guild.id, manager);

						return message.channel.send(`Created new react-role data under '${name}'.`);
					case '-d': case '--delete':
						if (!reactor)
							return message.channel.send(`No reactor with the name \`${name}\` exists. Create one with --new!`);

						// Remove from manager
						manager.reactors.splice(manager.reactors.indexOf(reactor), 1);
						message.channel.send('Deleted react-role data/message.');

						// Delete react-role message if one exists
						deleteReactMessage(message.guild, reactor)
						.then(() => reactDB.set(message.guild.id, manager))
						.catch(console.error);
						break;
					case '-ar': case '--add-role':
						if (!reactor)
							return message.channel.send(`No reactor with the name \`${name}\` exists. Create one with --new!`);

						// Try to add role to reactor.
						old_addRole(message, reactor, args)
						.then(() => reactDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);

						break;
					case '-rr': case '--remove-role':
						if (!reactor)
							return message.channel.send(`No reactor with the name \`${name}\` exists. Create one with --new!`);

						// Try to remove role from reactor.
						old_removeRole(message, reactor, args)
						.then(() => reactDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);

						break;
					case '-ce': case '--change-emoji':
						if (!reactor)
							return message.channel.send(`No reactor with the name \`${name}\` exists. Create one with --new!`);

						old_changeEmoji(message, reactor, args)
						.then(() => reactDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);
						break;
					case '-cm': case '--create-message':
						if (!reactor)
							return message.channel.send(`No reactor with the name \`${name}\` exists. Create one with --new!`);

						if (!reactor.roles.length)
							return message.channel.send(`You haven't added any roles to ${name} yet, a react-role message would be pointless!`);

						// Create embed message
						old_createReactMessage(message, reactor, args)
						.then(() => reactDB.set(message.guild.id, manager)) // Update database
						.catch (console.error);

						break;
					case '-st': case '--set-text':
						if (!reactor)
							return message.channel.send(`No reactor with the name \`${name}\` exists. Create one with --new!`);

						// Make sure there actually *is* a message to edit...
						if (!reactor.message)
							return message.channel.send('There is no message! Create one with --create-message.');

						// Get new text
						const new_text = args.join(' ');

						// Update the reactor
						reactor.text = new_text;

						// Update react-role message
						editReactMessage(message.guild, reactor)
						.then(() => reactDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);

						break;
				}
			})
		.catch(console.error);
	},
	help(prefix) {
		return `
${prefix}react (-l | --list)
${prefix}react (-n | --new) <name>
${prefix}react (-d | --delete) <name>
${prefix}react (-ar | --add-role) <name> <role> <emoji>
${prefix}react (-rr | --remove-role) <name> <role>
${prefix}react (-ce | --change-emoji) <name> <role> <emoji>
${prefix}react (-cm | --create-message) <name> <channel>
${prefix}react (-st | --set-text) <name> <message>

-l -list             Lists all reactors.
-n --new             Creates a new reactor identified by <name>.
-d --delete          Delete's the <name> reactor.
-ar --add-role       Adds <role> to <name>'s reactor.
-rr --remove-role    Removes <role> from <name>'s reactor.
-ce --change-emoji   Changes <name>'s <role> to use <emoji> as its reaction.
-cm --create-message Creates a message in <channel> where users can click on
                     reactions to receive specific roles.
-st --set-text       Change the description text of a reactor message.
`;
	},*/
}
