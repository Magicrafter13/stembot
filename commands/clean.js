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
	description: 'Cleans old roles from users. See \`catman\`.',
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
		}

		const roles = message.guild.roles;
		const catDB = settings.get('categories');
		catDB.get(message.guild.id)
			.then(categories => {
				if (categories === undefined)
					return message.channel.send(`No class information exists, set class categories with \`catman\`.`);

				categories.forEach(catData => purgeRoles(message, roles, catData.id, catData.roles));
			})
		.catch(console.error);
	},
};
