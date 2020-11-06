module.exports = {
	name: 'clean',
	description: 'Cleans bad roles from users',
	guildOnly: true,
	cooldown: 0,
	argsMin: 1,
	argsMax: -1,
	usage: '-b|--bot\n(or:) <required role> <sub-role 1> ...',
	execute(message, args) {
		// Check for authorization
		if (!message.member.hasPermission('MANAGE_ROLES'))
			return message.reply('You do not have adequate permissions to run this command.\nRequires: MANAGE_ROLES');

		// Clean bot-only role from users
		/*const botRoleNames = ['Bots'];
		if (args[0] === '-b' || args[0] === '--bot') {

		}*/

		// Any person without <required role> will have all sub-role n removed
		message.client.user.setActivity('Reading command.');
		const roles = message.guild.roles.cache;
		const masterRole = roles.findKey(role => role.toString() === args[0]);
		args.shift();
		const subRoles = args.map(arg => roles.findKey(role => role.toString() === arg));
		console.log(`Cleaning ${subRoles.length} roles.`);
		if (roles.has(masterRole)) {
			if (subRoles.length > 0) {
				const members = message.guild.members.cache;
				message.client.user.setActivity('Searching users.');
				console.log(`Scanning ${members.size} users.`);
				members.each(member => {
					if (!member.roles.cache.has(masterRole)) {
						subRoles.forEach(roleKey => {
							if (member.roles.cache.has(roleKey)) {
								message.channel.send(`Removing ${roles.get(roleKey)} from ${member.displayName}.`);
								member.roles.remove(roles.get(roleKey), `${message.author.username} requested role clean for users without ${roles.get(masterRole).name}.`);
							}
						})
					}
				})
			}
			else message.channel.send('Please specify at least one more argument.');
		}
		else message.channel.send('That role doesn\'t exist.');
		message.client.user.setActivity('');
	},
};
