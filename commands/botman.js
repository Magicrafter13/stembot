const { SlashCommandBuilder } = require('@discordjs/builders');
const { Permissions } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('botman')
		.setDescription('Manage Bot Roles.')
		.addSubcommand(subcommand => subcommand
			.setName('list')
			.setDescription("List bot-only roles."))
		.addSubcommand(subcommand => subcommand
			.setName('clear')
			.setDescription("Clear the bot-only role list."))
		.addSubcommand(subcommand => subcommand
			.setName('add')
			.setDescription('Add a role to the bot-only role list.')
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Enter the role to be considered a bot-only role:")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName('remove')
			.setDescription("Remove a role from the bot-only role list.")
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Enter the role to be removed from the bot-only role list:")
				.setRequired(true))),
	guildOnly: true,
	cooldown: 0.5,
	async execute(interaction) {
		// Check if user has required permissions.
		if (!interaction.memberPermissions.has(Permissions.FLAGS.MANAGE_ROLES, { checkAdmin: true }))
			return await interaction.reply({ content: 'You do not have adequate permissions for this command to work.\nRequires: MANAGE_ROLES', ephemeral: true });

		const botRoleDB = interaction.client.settings.get('botRoles');
		let botRoles = await botRoleDB.get(interaction.guildId)
			.then(botRoles => botRoles === undefined ? null : botRoles)
			.catch(error => console.error);
		if (botRoles === undefined)
			return await interaction.reply("There was an error reading the database!");

		// If no key/value exists for this guild, create one
		if (botRoles === null)
			botRoles = [];

		switch (interaction.options.getSubcommand()) {
			case 'list':
				return await interaction.reply(`Current Bot Roles List: [ ${botRoles.map(id => interaction.guild.roles.cache.find(role => role.id === id).toString()).join(', ')} ]`)
			case 'clear':
				await interaction.reply('Cleared bot role list.');
				botRoleDB.set(interaction.guildId, [])
				.then()
					.catch(error => {
						console.error(error);
						interaction.editReply("An error occured while clearing the bot role list!");
					});
				return;
			case 'add': {
				const role = interaction.options.getRole("role", true);
				if (interaction.guild.me.roles.highest.comparePositionTo(role) <= 0)
					return await interaction.reply(`I cannot manage this role! I can only manage roles below ${interaction.guild.me.roles.highest.toString()}.`);
				botRoles.push(role.id);
				botRoleDB.set(interaction.guildId, botRoles);
				return await interaction.reply(`Added ${role.toString()} to the bot role list.`);
			}
			case 'remove': {
				if (!botRoles.length)
					return await message.channel.send('Bot role list is empty!');

				const role = interaction.options.getRole("role", true);
				botRoles.splice(botRoles.indexOf(role.id), 1);
				botRoleDB.set(interaction.guildId, botRoles);
				return await interaction.reply(`Removed ${role.toString()} from the bot role list.`)
			}
		}
	},
	argsMin: 1,
	argsMax: 2,
	old_execute(message, args, settings) {
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
};
