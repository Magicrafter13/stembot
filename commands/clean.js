function purgeRoles(message, roles, masterRole, subRoles) {
	if (roles.has(masterRole)) {
		if (subRoles.length > 0) {
			const members = message.guild.members.cache;
			//message.client.user.setActivity('Searching users.');
			//console.log(`Scanning ${members.size} users.`);
			members.each(member => {
				if (!member.roles.cache.has(masterRole)) {
					subRoles.forEach(roleKey => {
						if (member.roles.cache.has(roleKey)) {
							message.channel.send(`Removing ${roles.get(roleKey).name} from ${member.displayName}.`);
							//member.roles.remove(roles.get(roleKey), `${message.author.username} requested role clean for users without ${roles.get(masterRole).name}.`);
						}
					});
				}
			});
		}
		else message.channel.send('Please specify at least one more argument.');
	}
	else message.channel.send('That role doesn\'t exist.');
}

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
		const botRoleNames = ['Bots'];
		if (args[0] === '-b' || args[0] === '--bot') {
			const roles = message.guild.roles.cache;
			const botRoles = botRoleNames.map(botRole => roles.findKey(role => role.name === botRole));
			const members = message.guild.members.cache;
			members.each(member => {
				if (!member.user.bot) {
					botRoles.forEach(roleKey => {
						if (member.roles.cache.has(roleKey)) {
							message.channel.send(`Removing ${roles.get(roleKey)} from ${member.displayName}.`);
							member.roles.remove(roles.get(roleKey), `${message.author.username} requested bot role clean, ${roles.get(roleKey).name} is configured as a bot only role.`);
						}
					});
				}
			});
			return;
		}

		let regex = args[0] === '-r' || args[0] === '--regex';
		if (regex) {
			args.shift();
			if (args.length < 2) return message.channel.send(`Expecting 3 arguments, only got ${args.length + 1}.`);
		}

		// Any person without <required role> will have all sub-role n removed
		//message.client.user.setActivity('Reading command.');
		const roles = message.guild.roles.cache;
		const masterRole = roles.findKey(role => role.toString() === args[0]);
		args.shift();
		if (regex) {
			// Get confirmation from at least one other Admin (unless command issued by server owner)
			if (message.member !== message.guild.owner) {
				let auth = false;
				//message.client.user.setActivity('Waiting for approval.');
				message.channel.send("Purging roles via Regular Expression requires approval of at least one more authorized user.\nIf you have the MANAGE_ROLES permission, and you approve of this action, please say `approve`.").then(() => {
					const filter = m => m.member.hasPermission('MANAGE_ROLES', {
						checkAdmin: true,
						checkOwner: true,
					}) && m.author !== message.author && m.content === 'approve';

					const approve = message.channel.createMessageCollector(filter, { time: 60000, max: 1, errors: ['time'] });
					approve.on('collect', messages => {
						message.channel.send('Authorization granted, continuing command execution.');
						auth = true;
						const re = new RegExp(args[0]);
						const subRoles = roles.filter(role => re.test(role.name)).map(val => roles.findKey(role => val === role));
						purgeRoles(message, roles, masterRole, subRoles);
					});
					approve.on('end', () => {
						if (!auth) message.channel.send('Authorization not received within acceptable timeframe, aborting command.');
					});
				});
			}
		}
		else {
			const subRoles = args.map(arg => roles.findKey(role => role.toString() === arg));
			purgeRoles(message, roles, masterRole, subRoles);
		}

		//console.log(`Cleaning ${regex ? '' : subRoles.length} roles.`);
		//message.client.user.setActivity('');
	},
};
