async function manageBotRoles(message, args, botRoleDB) {
	botRoleDB.get(message.guild.id)
		.then(botRoles => {
			// If no key/value exists for this guild, create one
			if (botRoles === undefined)
				botRoles = [];

			const cmd = args.shift();
			switch (cmd) {
				case 'clear':
					botRoleDB.set(message.guild.id, [])
					.then(message.channel.send('Cleared bot role list.'))
					.catch(console.error);
					break;
				case undefined: case 'list': break;
				case 'add':
					if (!args.length) return message.channel.send('Expected 3rd argument of type: Role');

					const role = message.guild.roles.cache.find(role => role.toString() === args[0]);
					if (role) {
						const id = role.id;
						botRoles.push(id);
						botRoleDB.set(message.guild.id, botRoles);
						message.channel.send(`Added ${role.toString()} to the bot role list.`);
					}
					else message.channel.send('3rd argument must be type: Role');
					break;
				default:
					return message.channel.send(`'${cmd}' is not a valid action.`);
			}

			// Show user updated list
			message.channel.send(`Current Bot Roles List: [ ${botRoles.map(id => message.guild.roles.cache.find(role => role.id === id).toString()).join(', ')} ]`);
		})
	.catch(err => console.error(`Error:\n${err}`));
}

module.exports = {
	name: 'set',
	description: 'Changes data/settings related to guild (server).',
	guildOnly: true,
	cooldown: 0.5,
	argsMin: 1,
	argsMax: -1,
	usage: '<setting> <action>',
	execute(message, args, settings) {
		const db = args.shift();
		switch (db) {
			case 'botRoles':
				const botRoleDB = settings.get(db);
				return manageBotRoles(message, args, botRoleDB);
				break;
			default:
				return message.channel.send(`${this.name}: unknown setting or database: ${db}`);
		}
	}
}
