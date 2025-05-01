import {
	ActivityType,
	Client,
	Collection,
	GatewayIntentBits,
	MessageFlags,
	PermissionFlagsBits,
	PresenceUpdateStatus,
} from "discord.js";     // Discord.js library - wrapper for Discord API
import fs from "fs";     // Node's native file system module
import Keyv from "keyv"; // Key-Value database
import KeyvRedis from "@keyv/redis";

// TODO: create integration role for bot, like most other bots have (server owners can't delete it without kicking the bot?)

// Setup and Load Database
const redisOptions = {
	url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
	username: process.env.REDIS_USER,
	password: process.env.REDIS_PASSWORD,

	socket: {
		host: process.env.REDIS_HOST,
		port: process.env.REDIS_PORT,

		tls: false,
	}
};
const botRoles = new Keyv({ store: new KeyvRedis(redisOptions), namespace: 'botRoles' });
const categories = new Keyv({ store: new KeyvRedis(redisOptions), namespace: 'categories' });
const react = new Keyv({ store: new KeyvRedis(redisOptions), namespace: 'react' });
botRoles.on('error', err => console.log('Connection Error', err));
categories.on('error', err => console.log('Connection Error', err));
react.on('error', err => console.log('Connection Error', err));

// Register Client
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		//GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMembers,
		//GatewayIntentBits.GuildEmojis,
	]
});

const settings = new Map();
settings.set('botRoles', botRoles);
settings.set('categories', categories);
settings.set('react', react);
client.settings = settings;

// Load commands.
client.commands = new Collection(); // Create commands property as a JS collection
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js')); // Get an array of all commands.
const commandModules = await Promise.all(commandFiles.map(file => import(`./commands/${file}`)));
for (const module of commandModules) {
	const command = module.default;
	client.commands.set(command.data.name, command);
}

const cooldowns = new Collection();
const permWhitelist = PermissionFlagsBits.Administrator; // Users with these permissions will not be subject to the cooldown.

// When client is ready, cache members, roles, and messages, for reaction events.
client.once('ready', async () => {
	console.log(`Logged in as ${client.user.tag}, and ready to serve.`);
	client.user.setPresence({ activities: [ { name: `/help`, type: ActivityType.Listening } ], status: PresenceUpdateStatus.Online });

	// Cache all members and roles
	Promise.all(client.guilds.cache.map(guild => [
		guild.members.fetch().then(members => console.log(`Fetched ${members.size} members from ${guild.id}.`)),
		guild.roles.fetch().then(roles => console.log(`Fetched ${roles.size} roles from ${guild.id}.`))
	]).flat());

	// Cache field/class messages.
	try {
		const fieldManagers = (await Promise.all(
			client.guilds.cache.map(guild =>
				categories.get(guild.id).then(manager => ({ guild, manager }))
			)
		)).filter(({ manager }) => manager);
		Promise.all(fieldManagers.map(({ guild, manager }) => [
			(manager.reactor.channel && manager.reactor.message && !guild.channels.resolve(manager.reactor.channel).messages.cache.has(manager.reactor.message))
				? guild.channels.fetch(manager.reactor.channel).then(channel => channel.messages.fetch(manager.reactor.message))
				: null,
			manager.fields.map(field => (field.reactor.channel && field.reactor.message && !guild.channels.resolve(field.reactor.channel).messages.cache.has(field.reactor.message)) ? guild.channels.resolve(field.reactor.channel).messages.fetch(field.reactor.message) : null)
		].flat().filter(promise => promise))).then(console.log('Cached all field and class messages.'));
	}
	catch (err) {
		console.error(err);
	}

	// Cache react messages.
	try {
		const reactManagers = (await Promise.all(
			client.guilds.cache.map(guild =>
				react.get(guild.id).then(manager => ({ guild, manager }))
			)
		)).filter(({ manager }) => manager);
		Promise.all(reactManagers.map(
			({ guild, manager }) => manager.reactors.map(reactor => (reactor.channel && reactor.message && !guild.channels.resolve(reactor.channel).messages.cache.has(reactor.message)) ? guild.channels.resolve(reactor.channel).messages.fetch(reactor.message) : null).filter(promise => promise)
		)).then(console.log('Cached all react messages.'));
	}
	catch (err) {
		console.error(err);
	}
});

client.on('messageReactionAdd', async (reaction, user) => {
	// Check if message from bot
	if (user.bot)
		return;

	if (reaction.partial) {
		try {
			await reaction.fetch()
		}
		catch (error) {
			console.error('Error occured while fetching message: ', error)
			return
		}
	}

	// Ignore reactions to messages not sent by the bot.
	if (reaction.message.author.id !== client.user.id)
		return;

	// Now check if message is a standard react-role message
	react.get(reaction.message.guild.id)
	.then(async manager => {
		if (!manager)
				return;

		// Get this message's reactor data
		const reactor = manager.reactors.find(searchReactor => searchReactor.message === reaction.message.id);
		if (!reactor)
				return;

		// Make sure this is a standard react-role message
		const roleInfo = reactor.roles.find(searchRole => searchRole.emoji === reaction.emoji.toString());
		if (!roleInfo)
			return; // This emoji is not being used for any of the roles (probably added by a user)

		// Return so we don't bother checking for a field/class react-role message reaction
		const member = await reaction.message.guild.members.fetch(user);
		const role = await reaction.message.guild.roles.fetch(roleInfo.id);
		await member.roles.add(role, 'User reacted to role embed.');
	})
	.catch(console.error);

	// Now check if message has field associated with it (reaction role message)
	categories.get(reaction.message.guild.id)
	.then(async manager => {
		if (!manager)
			return;

		// Check if message was for fields or classes.
		const type = reaction.message.id === manager.reactor.message ? 'field' : 'class';

		const field = type === 'class' ? manager.fields.find(searchField => searchField.reactor.message === reaction.message.id) : null;
		if (typeof field === "undefined")
			console.error(`${user} added a reaction, and this caused 'field' to be undefined. Happened in ${reaction.message.channel.name}`);

		const thing = type === 'field'
			? manager.fields.find(searchField => searchField.emoji === reaction.emoji.toString())
			: field.classes.find(searchClass => searchClass.emoji === reaction.emoji.toString());
		if (!thing)
			return; // Reacted with emoji not in list

		// If this reaction message is for a class, then make sure the user has the proper field role as well.
		if (type === 'class') {
			const fieldRole = reaction.message.guild.roles.cache.find(searchRole => searchRole.id === field.id);
			const member = reaction.message.guild.members.cache.find(searchMember => searchMember.user === user);

			if (!member.roles.cache.has(fieldRole.id)) {
				reaction.users.remove(member.user);
				member.send(`Sorry, you need the ${fieldRole.name} role to get this role.`);
				return;
			}
		}

		const member = await reaction.message.guild.members.fetch(user);
		const role = await reaction.message.guild.roles.fetch(type === 'field' ? thing.id : thing.role);
		await member.roles.add(role, 'User reacted to role embed.').then().catch(console.error);
	})
	.catch(console.error);
});

client.on('messageReactionRemove', async (reaction, user) => {
	// Check if message from bot
	if (user.bot)
		return;

	if (reaction.partial) {
		try {
			await reaction.fetch()
		}
		catch (error) {
			console.error('Error occured while fetching message: ', error)
			return;
		}
	}

	// Now check if message is a standard react-role message
	react.get(reaction.message.guild.id)
	.then(async manager => {
		if (!manager)
				return;

		// Get this message's reactor data
		const reactor = manager.reactors.find(searchReactor => searchReactor.message === reaction.message.id);

		// Make sure this is a standard react-role message
		if (!reactor)
				return;

		const roleInfo = reactor.roles.find(searchRole => searchRole.emoji === reaction.emoji.toString());
		if (!roleInfo)
			return; // This emoji is not being used for any of the roles (probably added by a user)

		// Return so we don't bother checking for a field/class react-role message reaction
		const member = await reaction.message.guild.members.fetch(user);
		const role = await reaction.message.guild.roles.fetch(roleInfo.id);
		await member.roles.remove(role, 'User reacted to role embed.');
	})
	.catch(console.error);

	// Now check if message has field associated with it (reaction role message)
	categories.get(reaction.message.guild.id)
	.then(async manager => {
		if (!manager)
			return;

		// Check if message was for fields or classes.
		const type = reaction.message.id === manager.reactor.message ? 'field' : 'class';

		const thing = type === 'field'
			? manager.fields.find(searchField => searchField.emoji === reaction.emoji.toString())
			: manager.fields.find(searchField => searchField.reactor.message === reaction.message.id).classes.find(searchClass => searchClass.emoji === reaction.emoji.toString());
		if (!thing)
			return; // Reacted with emoji not in list

		const member = await reaction.message.guild.members.fetch(user);
		const role = await reaction.message.guild.roles.fetch(type === 'field' ? thing.id : thing.role);
		member.roles.remove(role, 'User reacted to role embed.');
		// If this is a field role reaction being removed, then its corresponding class reactions ought to be removed as well.
		if (type === 'field')
			reaction.message.guild.channels.resolve(thing.reactor.channel).messages.resolve(thing.reactor.message).reactions.cache.forEach(classReaction => classReaction.users.remove(member));
	})
	.catch(console.error);
});

const DEFAULT_COOLDOWN = 0;
const MS_IN_S = 1_000;
const DESIRED_TIME_DECIMALS = 1;

// Handle slash commands
client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand())
		return;

	const command = client.commands.get(interaction.commandName);
	if (!command)
		return;

	if (command.guildOnly && interaction.channel.type === 'DM') {
		interaction.reply('This command cannot be used in a DM.');
		return;
	}

	// Cooldown logic.
	if (!cooldowns.has(command.data.name))
		cooldowns.set(command.data.name, new Collection());

	const now = Date.now();
	const timestamps = cooldowns.get(command.data.name);
	const cooldownAmount = (command.cooldown || DEFAULT_COOLDOWN) * MS_IN_S;

	if (timestamps.has(interaction.user.id)) {
		const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

		if (interaction.channel.type !== 'DM' && !interaction.member.permissions.any(permWhitelist)) {
			if (now < expirationTime) {
				const timeLeft = (expirationTime - now) / MS_IN_S;
				await interaction.reply(`please wait ${timeLeft.toFixed(DESIRED_TIME_DECIMALS)} more second(s) before reusing the ${command.data.name} command.`);
				return;
			}
		}
	}

	timestamps.set(interaction.user.id, now);
	setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

	// Command execution.
	await command.execute(interaction).catch(err => {
		console.error(err);
		interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
	});
});

// login with token
client.login(process.env.DISCORD_TOKEN);
