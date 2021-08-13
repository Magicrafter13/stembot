const { Permissions } = require('discord.js');

module.exports = {
	name: 'botman',
	description: 'Manage Bot Roles.',
	guildOnly: true,
	cooldown: 0.5,
	argsMin: 1,
	argsMax: 2,
	execute(message, args, settings) {
		// Check if user has required permissions.
		const guildMember = message.guild.members.cache.get(message.author.id);
		if (!guildMember.permissions.has(Permissions.FLAGS.MANAGE_ROLES, { checkAdmin: true }))
			return message.reply('You do not have adequate permissions for this command to work.\nRequires: MANAGE_ROLES');

		const botRoleDB = settings.get('botRoles');
		botRoleDB.get(message.guild.id)
			.then(botRoles => {
				// If no key/value exists for this guild, create one
				if (botRoles === undefined)
					botRoles = [];

				const cmd = args.shift();
				let role;
				switch (cmd) {
					case '-c': case '--clear':
						botRoleDB.set(message.guild.id, [])
						.then(message.channel.send('Cleared bot role list.'))
						.catch(console.error);
						break;
					case undefined: case '-p': case '--print': break;
					case '-a': case '--add':
						if (!args.length) return message.channel.send('Expected 3rd argument of type: Role');

						role = message.guild.roles.cache.find(role => role.toString() === args[0]);
						if (message.guild.me.roles.highest.comparePositionTo(role) > 0) {
							if (role) {
								const id = role.id;
								botRoles.push(id);
								botRoleDB.set(message.guild.id, botRoles);
								message.channel.send(`Added ${role.toString()} to the bot role list.`);
							}
							else message.channel.send('3rd argument must be type: Role');
						}
						else message.channel.send(`I cannot manage this role! I can only manage roles below ${message.guild.me.roles.highest.toString()}.`);
						break;
					case '-r': case '--remove':
						if (!botRoles.length) return message.channel.send('Bot role list is empty!');
						if (!args.length) return message.channel.send('Expected 3rd argument of type: Role');

						role = message.guild.roles.cache.find(role => role.toString() === args[0]);
						if (role) {
							botRoles.splice(botRoles.indexOf(role.id), 1);
							botRoleDB.set(message.guild.id, botRoles);
							message.channel.send(`Removed ${role.toString()} from the bot role list.`);
						}
						else message.channel.send('3rd argument must be type: Role');
						break;
					default:
						return message.channel.send(`'${cmd}' is not a valid action. See \`help botman\`.`);
				}

				// Show user updated list
				message.channel.send(`Current Bot Roles List: [ ${botRoles.map(id => message.guild.roles.cache.find(role => role.id === id).toString()).join(', ')} ]`);
			})
		.catch(console.error);
	},
	help(prefix) {
		return `
${prefix}botman (-p | -c)
${prefix}botman (-a | -r) <role>

\t-p --print   Shows which roles are currently saved in the manager.
\t-c --clear   Clears the list of roles from the manager.
\t-a --add     Adds role to the manager.
\t-r --remove  Removes role from the manager.
`;
	},
}
