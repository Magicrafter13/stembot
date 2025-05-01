import { PermissionFlagsBits } from 'discord.js';
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
			return interaction.reply({ content: 'You do not have adequate permissions for this command to work.\nRequires: MANAGE_ROLES', ephemeral: true });

		const botRoleDB = await interaction.client.settings.get('botRoles');
		let botRoles = await botRoleDB.get(interaction.guildId);
		if (typeof botRoles === "undefined")
			return interaction.reply({ content: "There was an error reading the database!", ephemeral: true });

		// If no key/value exists for this guild, create one
		if (botRoles === null)
			botRoles = [];

		const subcommand = interaction.options.getSubcommand();
		switch (subcommand) {
			case 'list':
				return interaction.reply(`Current Bot Roles List: [ ${botRoles.map(id => interaction.guild.roles.cache.find(role => role.id === id).toString()).join(', ')} ]`)
			case 'clear':
				return botRoleDB.set(interaction.guildId, [])
				.then(interaction.reply('Cleared bot role list.'))
				.catch(error => {
					console.error(error);
					interaction.editReply("An error occured while clearing the bot role list. Database not updated!");
				});
			case 'add': {
				const role = interaction.options.getRole("role", true);
				if (interaction.guild.members.me.roles.highest.comparePositionTo(role) <= 0)
					return interaction.reply(`I cannot manage this role! I can only manage roles below ${interaction.guild.members.me.roles.highest}.`);
				botRoles.push(role.id);
				return botRoleDB.set(interaction.guildId, botRoles)
				.then(interaction.reply(`Added ${role} to the bot role list.`));
			}
			case 'remove': {
				if (!botRoles.length)
					return interaction.reply({ content: 'Bot role list is empty!', ephemeral: true });

				const role = interaction.options.getRole("role", true);
				botRoles.splice(botRoles.indexOf(role.id), 1);
				return botRoleDB.set(interaction.guildId, botRoles)
				.then(interaction.reply(`Removed ${role.toString()} from the bot role list.`));
			}
		}

		throw new TypeError(`${subcommand} is not a valid subcommand!`);
	},
};
