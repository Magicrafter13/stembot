const { SlashCommandBuilder } = require('@discordjs/builders');
const { Permissions } = require('discord.js');

function purgeRoles(interaction, masterID, subIDs) {
	console.log(`master: ${masterID}\nsub: ${subIDs}`);
	const roles = interaction.guild.roles;
	roles.fetch(masterID)
		.then(masterRole => {
			subIDs.forEach(id => {
				roles.fetch(id)
					.then(role => {
						role.members.each(member => {
							if (!member.roles.cache.has(masterID)) {
								interaction.followUp(`Removing ${role.name} from ${member.displayName}.`);
								console.log(`Removing ${role.name} from ${member.displayName}.`);
								member.roles.remove(id, `${message.author.username} requested role clean. User did not have ${masterRole.name}.`);
							}
						});
					})
				.catch(console.error);
			})
		})
	.catch(console.error);
}

function old_purgeRoles(message, roles, masterID, subIDs) {
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
	data: new SlashCommandBuilder()
		.setName('clean')
		.setDescription('Remove (clean) Roles.')
		.addIntegerOption(option => option
			.setName("bot")
			.setDescription("Clean bot roles from users.")
			.setRequired(false)
			.addChoice("Enable", 1)),
	guildOnly: true,
	cooldown: 0,
	async execute(interaction) {
		// Check for authorization
		if (!interaction.memberPermissions.has(Permissions.FLAGS.MANAGE_ROLES))
			return await interaction.reply({ content: 'You do not have adequate permissions to run this command.\nRequires: MANAGE_ROLES', ephemeral: true });

		// Clean bot-only role from users
		if (interaction.options.getInteger("bot", false)) {
			await interaction.reply('Removing bot roles from users...');

			const botRoleDB = interaction.client.settings.get('botRoles');
			let botRoleIDs = await botRoleDB.get(interaction.guildId)
			.then(botRoleIDs => botRoleIDs === undefined ? null : botRoleIDs)
			.catch(console.error);
			if (botRoleIDs === undefined)
				return await interaction.editReply("There was an error reading the database!");

			if (botRoleIDs === null)
				botRoleIDs = [];

			if (botRoleIDs.length) {
				const botRoles = botRoleIDs.map(id => interaction.guild.roles.cache.find(role => role.id === id));
				botRoles.forEach(role => {
					role.members.each(member => {
						if (!member.user.bot) {
							member.roles.remove(role, `${interaction.user.username} requested bot role clean, ${role.name} is in the bot role list.`);
							interaction.followUp(`Removed ${role} from ${member.displayName}.`);
						}
					});
				});
				return await interaction.editReply("Removed bot roles from users.");
			}
			return await interaction.editReply('Bot Role list is empty, add roles to it with \`/botman add\`.');
		}

		await interaction.reply('Cleaning user roles...');

		const catDB = interaction.client.settings.get('categories');
		let categories = await catDB.get(interaction.guildId)
		.then(categories => categories === undefined ? null : categories)
		.catch(console.error);
		if (catDB === undefined)
			return await interaction.editReply("There was an error reading the database!");

		if (catDB === null)
			return await interaction.editReply(`No field information exists, set fields with \`/catman\`.`);

		categories.fields.forEach(field => purgeRoles(interaction, field.id, field.classes.map(class_data => class_data.role)));
		return await interaction.editReply("Cleaned user roles.");
	},
	argsMin: 0,
	argsMax: 1,
	old_execute(message, args, settings) {
		// Check for authorization
		if (!message.member.permissions.has(Permissions.FLAGS.MANAGE_ROLES))
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
					return message.channel.send(`No field information exists, set fields with \`catman\`.`);

				categories.fields.forEach(field => old_purgeRoles(message, roles, field.id, field.classes.map(the_class => the_class.role)));
			})
		.catch(console.error);
	},
	help(prefix) {
		return `
${prefix}clean
${prefix}clean (-b | --bot)

For each field in the manager (see catman), removes all class roles from users who don't have the field's role.
\t-b --bot  Removes all roles in the manager (see botman) from non-bot users.
`;
	},
};
