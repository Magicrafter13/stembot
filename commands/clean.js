import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';

function purgeRoles(interaction, masterID, subIDs) {
	console.log(`master: ${masterID}\nsub: ${subIDs}`);
	const { roles } = interaction.guild;
	return roles.fetch(masterID)
	.then(masterRole => Promise.all(
		subIDs.map(id =>
			roles.fetch(id)
			.then(role =>
				role.members
				.filter(member => !member.roles.cache.has(masterID))
				.map(member => [
					interaction.followUp(`Removing ${role.name} from ${member.displayName}.`),
					member.roles.remove(id, `${interaction.user.username} requested role clean. User did not have ${masterRole.name}.`),
				])
				.flat()
			)
			.catch(console.error)
		).flat()
	))
	.catch(console.error);
}

export default {
	data: new SlashCommandBuilder()
		.setName('clean')
		.setDescription('Remove (clean) Roles.')
		.addIntegerOption(option => option
			.setName("bot")
			.setDescription("Clean bot roles from users.")
			.setRequired(false)
			.addChoices({ name: "Enable", value: 1 })),
	guildOnly: true,
	cooldown: 0,
	async execute(interaction) {
		// Check for authorization
		if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles))
			return interaction.reply({ content: 'You do not have adequate permissions to run this command.\nRequires: MANAGE_ROLES', ephemeral: true });

		// Clean bot-only role from users
		if (interaction.options.getInteger("bot", false)) {
			const botRoleIDs = await interaction.client.settings.get('botRoles').get(interaction.guildId) ?? [];

			if (!botRoleIDs.length)
				return interaction.reply({ content: 'Bot Role list is empty, add roles to it with `/botman add`.', flags: MessageFlags.Ephemeral });

			await interaction.reply('Removing bot roles from users...');

			return Promise.all(
				botRoleIDs.map(id => interaction.guild.roles.cache.find(role => role.id === id))
				.map(role =>
					role.members.filter(member => !member.user.bot).map(member =>
						member.roles.remove(role, `${interaction.user.username} requested bot role clean, ${role.name} is in the bot role list.`)
						.then(() => interaction.followUp(`Removed ${role} from ${member.displayName}.`))
					)
				)
			)
			.then(() => interaction.editReply("Removed bot roles from users."));
		}

		const categories = await interaction.client.settings.get('categories').get(interaction.guildId);

		if (!categories)
			return interaction.reply(`No field information exists, set fields with \`/catman\`.`);

		await interaction.reply('Cleaning user roles...');

		return Promise.all(categories.fields.map(field =>
			purgeRoles(interaction, field.id, field.classes.map(classData => classData.role))
		)).then(() => interaction.editReply("Cleaned user roles."));
	},
};
