const Discord = require('discord.js'); // Discord.js library - wrapper for Discord API

async function editReactorText(message, data, args) {
	// Get new string from user's command, and update message.
	data.reactor.text = args.join(' ');

	// Update embed message
	editReactMessage(message, data)
	.then(message.channel.send('Message text updated.'))
	.catch(console.error);

	return;
}

async function addRole(message, reactor, args) {
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
	await setEmoji(message, reactor, new_obj, args);

	// Check if emoji was successfully added, or if it was already in use
	if (new_obj.emoji) {
		reactor.roles.push(new_obj);
		message.channel.send(`${new_role} added to react-role message.`);

		// Check if a react-role message exists, and update it
		if (reactor.message && reactor.channel)
			editReactMessage(message.guild, reactor);
	}
}

async function removeRole(message, reactor, args) {
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

}

async function changeEmoji(message, reactor, args) {
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
	setEmoji(message, reactor, obj, args)
		.then(() => {
			if (reactor.channel && reactor.message)
				editReactMessage(message.guild, reactor);
		})
	.catch(console.error);
}

async function setEmoji(message, reactor, role, args) {
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
		msg.reactions.cache.find(reaction => reaction.emoji.toString() === role.emoji).remove();
	}
	// Update the emoji
	role.emoji = emoji;
}

async function createReactMessage(message, reactor, args) {
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
	const embed_message = await channel.send({ embed: { title: 'Generating embed...' } });

	// Save message/channel id in reactor
	reactor.message = embed_message.id;
	reactor.channel = channel.id;

	// Generate embed
	return editReactMessage(message.guild, reactor).catch(console.error);
}

async function deleteReactMessage(guild, reactor) {
	guild.channels.resolve(reactor.channel).messages.fetch(reactor.message)
	.then(m => m.delete({ reason: 'Old react-role message being deleted for new one.' }))
	.catch(console.error);
}
async function editReactMessage(guild, reactor) {
	// TODO: remove this
	if (!reactor.message)
		return;

	// Get a text friendly list of roles
	const roles = reactor.roles.map(role => `${role.emoji} - ${guild.roles.resolve(role.id)}`).join('\n');

	const embed = new Discord.MessageEmbed()
	.setColor('#ee3f20')
	.setTitle('Roles')
	.setAuthor('Clark Stembot', 'https://www.clackamas.edu/images/default-source/logos/nwac/clark_college_300x300.png', 'https://gitlab.com/Magicrafter13/stembot')
	.setDescription(reactor.text)
	//.setThumbnail('link')
	.addFields({ name: reactor.roles.length ? 'Roles:' : 'None available (use --new)!', value: roles })
	//.setImage('link')
	.setTimestamp()
	.setFooter('Report bugs on our GitLab repository.');

	const channel = guild.channels.resolve(reactor.channel)
	channel.messages.fetch(reactor.message)
		.then(message => {
			message.edit(embed)
				.then(() => {
					reactor.roles.forEach(role => {
						if (role.emoji)
							message.react(role.emoji);
					});
				})
			.catch(console.error);
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
	name: 'react',
	description: 'Create, Edit, and Delete react-role messages.',
	guildOnly: true,
	cooldown: 0.5,
	argsMin: 1,
	argsMax: -1,
	execute(message, args, settings) {
		// Check if user has required permissions.
		const guildMember = message.guild.member(message.author);
		if (!guildMember.hasPermission('MANAGE_ROLES', { checkAdmin: true }))
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
						if (reactor)
							return message.channel.send('A react-role message with this name already exists!');

						if (!name)
							return message.channel.send('Missing argument, requires name.');

						const new_reactor = newReactor;
						new_reactor.name = name;

						manager.reactors.push(new_reactor);
						reactDB.set(message.guild.id, manager);
						break;
					case '-ar': case '--add-role':
						if (!reactor)
							return message.channel.send(`No reactor with the name \`${name}\` exists. Create one with --new!`);

						// Try to add role to reactor.
						addRole(message, reactor, args)
						.then(() => reactDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);

						break;
					case '-rr': case '--remove-role':
						if (!reactor)
							return message.channel.send(`No reactor with the name \`${name}\` exists. Create one with --new!`);

						// Try to remove role from reactor.
						removeRole(message, reactor, args)
						.then(() => reactDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);

						break;
					case '-ce': case '--change-emoji':
						if (!reactor)
							return message.channel.send(`No reactor with the name \`${name}\` exists. Create one with --new!`);

						changeEmoji(message, reactor, args)
						.then(() => reactDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);
						break;
					case '-cm': case '--create-message':
						if (!reactor)
							return message.channel.send(`No reactor with the name \`${name}\` exists. Create one with --new!`);

						if (!reactor.roles.length)
							return message.channel.send(`You haven't added any roles to ${name} yet, a react-role message would be pointless!`);

						// Create embed message
						createReactMessage(message, reactor, args)
						.then(() => reactDB.set(message.guild.id, manager)) // Update database
						.catch (console.error);

						break;
					case '-st': case '--set-text':
						// Make sure there actually *is* a message to edit...
						if (!manager.reactor.message)
							return message.channel.send('There is no message! Create one with --create-message.');

						// Update reactor
						editReactorText(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);

						break;
				}
			})
		.catch(console.error);
	},
	help(prefix) {
		return `
Full documentation too long for Discord message, please see GitLab wiki for more!

${prefix}catman (-l | --list)
${prefix}catman [role] (-se | --set-emoji) <field/class> <emoji>
${prefix}catman [role] (-cm | --create-message) <channel> (message)
${prefix}catman <role> (-sc | --set-category) <category_name>
${prefix}catman <role> (-sp | --set-prefix) <prefix>
${prefix}catman <role> --purge
${prefix}catman <role> (-a | -c | -r | -d) <class_number>
${prefix}catman <role> (-p | --print)

Without <role>
\t-l --list             Shows the fields currently stored in the manager (roles).
\t-se --set-emoji       Sets <field> to use <emoji> with role-react embed.
\t-cm --create-message  Creates a message in <channel> where users can click on
\t                      reactions to receive specific roles. Optional (message) to
\t                      display in the embed.
With <role>
\t-sc --set-category    Sets the Channel Category for this field to a category called
\t                      category_name (if one exists).
\t-sp --set-prefix      Sets the role/channel prefix for this field.
\t-se --set-emoji       Sets <class> to use <emoji> with role-react embed.
\t--purge               Deletes this field from the manager.
\t-a --add              Adds a role beginning with the field prefix, a space, and
\t                      class_number, and a channel beginning with field prefix, and
\t                      class_number.
\t-c --create           Creates a new role and channel, following the same convention
\t                      above.
\t-r --remove           Removes class_number from this field.
\t-d --delete           Removes class_number from this field, then deletes the role.
\t                      Channel must be deleted manually.
\t-p --print            Displays the information the manager has on this field.
`;
	},
}
