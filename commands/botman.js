import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';

export default {
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
		if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles, { checkAdmin: true }))
			return interaction.reply({ content: 'You do not have adequate permissions for this command to work.\nRequires: MANAGE_ROLES', flags: MessageFlags.Ephemeral });

		const botRoleDB = await interaction.client.settings.get('botRoles');
		const botRoles = await botRoleDB.get(interaction.guildId)
		.then(data => data ? data : []);

		const subcommand = interaction.options.getSubcommand();
		switch (subcommand) {
			case 'list':
				return interaction.reply(`Current Bot Roles List: [ ${botRoles.map(id => interaction.guild.roles.cache.find(role => role.id === id).toString()).join(', ')} ]`)
			case 'clear':
				return botRoleDB.set(interaction.guildId, [])
				.then(() => interaction.reply('Cleared bot role list.'))
				.catch(error => {
					console.error(error);
					interaction.editReply("An error occured while clearing the bot role list. Database not updated!");
				});
			case 'add': {
				const role = interaction.options.getRole("role", true);
				if (interaction.guild.members.me.roles.highest.comparePositionTo(role) <= 0)
					return interaction.reply({ content: `I cannot manage this role! I can only manage roles below ${interaction.guild.members.me.roles.highest}.`, flags: MessageFlags.Ephemeral });

				const index = botRoles.indexOf(role.id);
				if (index !== -1)
					return interaction.reply({ content: `${role} is already in the bot role list!`, flags: MessageFlags.Ephemeral });

				botRoles.push(role.id);
				return botRoleDB.set(interaction.guildId, botRoles)
				.then(() => interaction.reply(`Added ${role} to the bot role list.`));
			}
			case 'remove': {
				if (!botRoles.length)
					return interaction.reply({ content: 'Bot role list is empty!', flags: MessageFlags.Ephemeral });

				const role = interaction.options.getRole("role", true);
				const index = botRoles.indexOf(role.id);
				if (index === -1)
					return interaction.reply({ content: `${role} is not in the bot role list!`, flags: MessageFlags.Ephemeral });

				botRoles.splice(index, 1);
				return botRoleDB.set(interaction.guildId, botRoles)
				.then(() => interaction.reply(`Removed ${role.toString()} from the bot role list.`));
			}
		}

		throw new TypeError(`${subcommand} is not a valid subcommand!`);
	},
};
