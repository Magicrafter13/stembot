function purgeRoles(message, roles, masterID, subIDs) {
	roles.fetch(masterID)
		.then(masterRole => {
			subIDs.forEach(id => {
				roles.fetch(id)
					.then(role => {
						role.members.each(member => {
							if (!member.roles.cache.has(masterID)) {
								message.channel.send(`Removing ${role.name} from ${member.displayName}.`);
								member.roles.remove(id, `${message.author.username} requested role clean. User did not have ${masterRole.name}.`);
							}
						});
					})
				.catch(console.error);
			})
		})
	.catch(console.error);
}

module.exports = {
	name: 'clean',
	description: 'Cleans bad roles from users',
	guildOnly: true,
	cooldown: 0,
	argsMin: 0,
	argsMax: 1,
	usage: '-b|--bot\n(or:) <required role> <sub-role 1> ...',
	execute(message, args, settings) {
		// Check for authorization
		if (!message.member.hasPermission('MANAGE_ROLES'))
			return message.reply('You do not have adequate permissions to run this command.\nRequires: MANAGE_ROLES');

		// Clean bot-only role from users
		const botRoleNames = ['Bots'];
		if (args[0] === '-b' || args[0] === '--bot') {
			const botRoleDB = settings.get('botRoles');
			botRoleDB.get(message.guild.id)
				.then(botRoleIDs => {
					if (botRoleIDs === undefined)
						botRoleIDs = [];

					if (botRoleIDs.length) {
						const botRoles = botRoleIDs.map(id => message.guild.roles.cache.find(role => role.id === id));
						botRoles.forEach(role => {
							role.members.each(member => {
								if (!member.user.bot) {
									message.channel.send(`Removing ${role.toString()} from ${member.displayName}.`);
									member.roles.remove(role, `${message.author.username} requested bot role clean, ${role.name} is in the bot role list.`);
								}
							});
						});
					}
					else return message.channel.send('Bot Role list is empty, add roles to it with\n\`\`\`\nset botRoles add <role>\n\`\`\`');
				})
			.catch(console.error);
			return;
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

		// Any person without <required role> will have all sub-role n removed
		const roles = message.guild.roles;
		const catDB = settings.get('categories');
		catDB.get(message.guild.id)
			.then(categories => {
				if (categories === undefined)
					return message.channel.send(`No class information exists, set class categories with \`catman\`.`);

				categories.forEach(catData => purgeRoles(message, roles, catData.id, catData.roles));
			})
		.catch(console.error);
		/*const masterRole = roles.findKey(role => role.toString() === args[0]);
		args.shift();
		const subRoles = args.map(arg => roles.findKey(role => role.toString() === arg));
		purgeRoles(message, roles, masterRole, subRoles);*/
	},
};
