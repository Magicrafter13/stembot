const fs = require('fs'); // Node's native file system module
const { Client, Collection, GatewayIntentBits, MessageFlags } = require('discord.js'); // Discord.js library - wrapper for Discord API
const Keyv = require('keyv').default; // Key-Value database
const KeyvRedis = require('@keyv/redis').default;

// TODO: create integration role for bot, like most other bots have (server owners can't delete it without kicking the bot?)

// Bot config file
//  - prefix: Command prefix for messages directed at bot
//const { prefix } = require('./config.json');

const { version } = require('./package.json');
const version_short = version.replace(/\.\d+$/, '');

// Setup Database
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

let settings = new Map();
settings.set('botRoles', botRoles);
settings.set('categories', categories);
settings.set('react', react);

// Register Client
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		//GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMembers,
		//GatewayIntentBits.GuildEmojis,
		GatewayIntentBits.GuildPresences,
	]
}); // register Discord client
client.commands = new Collection(); // Create commands property as a JS collection
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js')); // Get an array of all commands.
client.settings = settings;

// Load each .js command file
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);

	// set a new item in the Collection
	// with the key as the command name and the value as the exported module
	client.commands.set(command.data.name, command);
}

const cooldowns = new Collection();
const permWhitelist = ['ADMINISTRATOR']; // Users with these permissions will not be subject to the cooldown.

// Execute first time ready event is received only
client.once('ready', () => {
	console.log(`Logged in as ${client.user.tag}, and ready to serve.`);
	client.user.setPresence({ activities: [ { name: `/help`, type: 'LISTENING' } ], status: 'online' });

	// Cache react-role messages, so they are ready for messageReaction events.
	const fieldDB = settings.get('categories');
	const reactDB = settings.get('react');
	client.guilds.cache.each(guild => {
		console.log(`Caching messages in ${guild}.`)
		fieldDB.get(guild.id)
			.then(async function (manager) {
				if (!manager)
					return; // User has no field manager database setup

				// Cache field react-role message
				if (manager.reactor.channel &&
					manager.reactor.message &&
					!guild.channels.resolve(manager.reactor.channel)
						.messages.cache.has(manager.reactor.message)) {
					guild.channels.fetch(manager.reactor.channel)
					.then(channel => channel.messages.fetch(manager.reactor.message))
					.catch(console.error);
				}

				// Cache all class react-role messages
				manager.fields.forEach(async function (field) {
					if (field.reactor.channel &&
						field.reactor.message &&
						!guild.channels.resolve(field.reactor.channel)
							.messages.cache.has(field.reactor.message)) {
						await guild.channels.resolve(field.reactor.channel)
							.messages.fetch(field.reactor.message).catch(console.error);
					}
				});

				// Cache all members and roles
				guild.members.fetch()
				.then(members => console.log(`Fetched ${members.size} roles.`))
				.catch(console.error);
				guild.roles.fetch()
				.then(roles => console.log(`Fetched ${roles.size} roles.`))
				.catch(console.error);
			})
		.catch(console.error);
		reactDB.get(guild.id)
			.then(async function (manager) {
				if (!manager)
					return; // User has no reactor database setup

				// Cache all general react-role messages
				manager.reactors.forEach(async function (reactor) {
					if (reactor.channel &&
						reactor.message &&
						!guild.channels.resolve(reactor.channel)
							.messages.cache.has(reactor.message)) {
						await guild.channels.resolve(reactor.channel)
							.messages.fetch(reactor.message);
					}
				})
			})
		.catch(console.error);
		console.log("Done caching I guess");
	});
});

client.on('messageReactionAdd', async (reaction, user) => {
	if (reaction.partial) {
		try { await reaction.fetch() }
		catch (error) { return console.error('Error occured while fetching message: ', error) }
	}
	// Check if message from bot
	if (user.bot) return;

	// Ignore reactions to messages not sent by the bot.
	if (reaction.message.author.id != client.user.id)
		return;

	// Now check if message is a standard react-role message
	const reactDB = settings.get('react');
	const std_manager = await reactDB.get(reaction.message.guild.id);
	if (std_manager) {
		// Get this message's reactor data
		const reactor = std_manager.reactors.find(reactor => reactor.message === reaction.message.id);

		// Make sure this is a standard react-role message
		if (reactor) {
			const role = reactor.roles.find(role => role.emoji === reaction.emoji.toString());
			if (!role)
				return; // This emoji is not being used for any of the roles (probably added by a user)

			// Return so we don't bother checking for a field/class react-role message reaction
			return reaction.message.guild.members.fetch(user)
				.then(member => {
					reaction.message.guild.roles.fetch(role.id)
					.then(role_obj => member.roles.add(role_obj, 'User reacted to role embed.').then().catch(console.error))
					.catch(console.error);
				})
			.catch(console.error);
		}
	}

	// Now check if message has field associated with it (reaction role message)
	const guildFields = settings.get('categories');
	guildFields.get(reaction.message.guild.id)
		.then(manager => {
			if (!manager)
				return; // Guild has no managed fields

			// Check if message was for fields or classes.
			const type = reaction.message.id === manager.reactor.message ? 'field' : 'class';

			const field = type === 'class' ? manager.fields.find(f => f.reactor.message === reaction.message.id) : null;
			if (field === undefined)
				console.log(`${user} added a reaction, and this caused 'field' to be undefined. Happened in ${reaction.message.channel.name}`);

			const thing = type === 'field'
				? manager.fields.find(f => f.emoji === reaction.emoji.toString())
				: field.classes.find(c => c.emoji === reaction.emoji.toString());
			if (!thing)
				return; // Reacted with emoji not in list

			// If this reaction message is for a class, then make sure the user has the proper field role as well.
			if (type === 'class') {
				const fieldRole = reaction.message.guild.roles.cache.find(role => role.id === field.id);
				const member = reaction.message.guild.members.cache.find(member => member.user === user);

				if (!member.roles.cache.has(fieldRole.id)) {
					reaction.users.remove(member.user);
					return member.send(`Sorry, you need the ${fieldRole.name} role to get this role.`);
				}
			}

			reaction.message.guild.members.fetch(user)
				.then(member => {
					reaction.message.guild.roles.fetch(type === 'field' ? thing.id : thing.role)
					.then(role => member.roles.add(role, 'User reacted to role embed.').then().catch(console.error))
					.catch(console.error);
				})
			.catch(console.error)
		})
	.catch(console.error);
});

client.on('messageReactionRemove', async (reaction, user) => {
	if (reaction.partial) {
		try { await reaction.fetch() }
		catch (error) { return console.error('Error occured while fetching message: ', error) }
	}
	// Check if message from bot
	if (user.bot) return;

	// Now check if message is a standard react-role message
	const reactDB = settings.get('react');
	const std_manager = await reactDB.get(reaction.message.guild.id);
	if (std_manager) {
		// Get this message's reactor data
		const reactor = std_manager.reactors.find(reactor => reactor.message === reaction.message.id);

		// Make sure this is a standard react-role message
		if (reactor) {
			const role = reactor.roles.find(role => role.emoji === reaction.emoji.toString());
			if (!role)
				return; // This emoji is not being used for any of the roles (probably added by a user)

			// Return so we don't bother checking for a field/class react-role message reaction
			return reaction.message.guild.members.fetch(user)
				.then(member => {
					reaction.message.guild.roles.fetch(role.id)
					.then(role_obj => member.roles.remove(role_obj, 'User reacted to role embed.').then().catch(console.error))
					.catch(console.error);
				})
			.catch(console.error);
		}
	}

	// Now check if message has field associated with it (reaction role message)
	const guildFields = settings.get('categories');
	guildFields.get(reaction.message.guild.id)
		.then(manager => {
			if (!manager)
				return; // Guild has no managed fields

			// Check if message was for fields or classes.
			const type = reaction.message.id === manager.reactor.message ? 'field' : 'class';

			const thing = type === 'field'
				? manager.fields.find(f => f.emoji === reaction.emoji.toString())
				: manager.fields.find(f => f.reactor.message === reaction.message.id).classes.find(c => c.emoji === reaction.emoji.toString());
			if (!thing)
				return; // Reacted with emoji not in list

			reaction.message.guild.members.fetch(user)
				.then(member => {
					reaction.message.guild.roles.fetch(type === 'field' ? thing.id : thing.role)
					.then(role => member.roles.remove(role, 'User reacted to role embed.').then().catch(console.error))
					.catch(console.error);
					// Remove class roles if field role removed
					if (type === 'field') {
						// Remove reactions to class react-role message
						reaction.message.guild.channels.resolve(thing.reactor.channel)
						.messages.resolve(thing.reactor.message)
							.reactions.cache.forEach(class_reaction => class_reaction.users.remove(member)); // Is this actually any different than before? Might be a waste of code...
					}
				})
			.catch(console.error)
		})
	.catch(console.error);
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand())
		return;

	const command = client.commands.get(interaction.commandName);

	if (!command)
		return;

	if (command.guildOnly && interaction.channel.type === 'DM')
		return await interaction.reply('This command cannot be used in a DM.');

	/*if (!cooldowns.has(command.data.name)) {
		cooldowns.set(command.data.name, new Collection());
	}

	const now = Date.now();
	const timestamps = cooldowns.get(command.name);
	const cooldownAmount = (command.cooldown || 0) * 1000;

	if (timestamps.has(interaction.member.id)) {
		const expirationTime = timestamps.get(interaction.member.id) + cooldownAmount;

		if (interaction.channel.type !== 'DM' && !interaction.member.permissions.any(permWhitelist)) {
			if (now < expirationTime) {
				const timeLeft = (expirationTime - now) / 1000;
				return await interaction.reply(`please wait ${timeLeft.toFixed(1)} more second(s) before reusing the ${command.data.name} command.`);
			}
		}
	}

	timestamps.set(interaction.member.id, now);
	// TODO: Client#setTImeout has been removed, need to find new way to implement command cooldown system, or abandon it!
	setTimeout(() => timestamps.delete(interaction.member.id), cooldownAmount);*/

	try {
		await command.execute(interaction);
	}
	catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
	}
});

// Handle messages from users (requires channel read permission)
/*client.on('messageCreate', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return; // checks for prefix

	const args = message.content.slice(prefix.length).trim().split(/ +/); // looks for arguments and assigns them
	const commandName = args.shift().toLowerCase(); // takes command and makes it lowercase/assigns it to variable

	// Handle help
	if (commandName === 'help') {
		if (args.length) {
			const cmdQuery = client.commands.get(args.shift().toLowerCase());
			if (!cmdQuery) return message.channel.send(`Command does not exist!`);

			message.channel.send(`${cmdQuery.name} - ${cmdQuery.description}\nUsage:`);
			return message.channel.send(`\`\`\`${cmdQuery.help(prefix)}\`\`\`\nNeed more help? Visit the wiki page for this command: <https://gitlab.com/Magicrafter13/stembot/-/wikis/Commands/${cmdQuery.name}>`);
		}
		else {
			const cmdList = (message.channel.type === 'dm' ? client.commands.filter(command => !command.guildOnly) : client.commands).map(command => `${command.name} - ${command.description}`);
			return message.channel.send({
				content: `These are the available commands, say \`${prefix}help <commandName>\` to see help for that command:\n\`\`\`\n${cmdList.join('\n')}\n\`\`\``,
				embeds: [
					{
						hexColor: '#800028',
						author: {
							name: 'Clark Stembot',
							iconURL:  'https://www.clackamas.edu/images/default-source/logos/nwac/clark_college_300x300.png',
							url:  'https://gitlab.com/Magicrafter13/stembot'
						},
						fields: [
							{
								name: 'Need More Info?',
								value: 'Check out the documentation on the [Wiki](https://gitlab.com/Magicrafter13/stembot/-/wikis/home)!'
							},
							{
								name: 'Found a Bug? Have a New Feature Idea?',
								value: 'Submit reports/ideas on [the issues page](https://gitlab.com/Magicrafter13/stembot/-/issues).'
							}
						],
						footer: {
							text: `Clark Stembot - Version ${version_short}`
						},
						timestamp: Date.now(),
						type: 'rich'
					}
				]
			});
		}
	}

	// Handle normal commands
	// Recommend the cooldown code is moved inside the try-catch area, just to be safe
	if (!client.commands.has(commandName)) return;

	const command = client.commands.get(commandName);

	if (!command) return; // No command called 'commandName' exists

	if (command.guildOnly && message.channel.type === 'dm')
		return message.reply('This command cannot be used in a DM.');*/

	/*
	 * May not actually go this route, as I plan to make some more complex commands, and I feel it may be
	 * easier to handle the usage output from the command file. At the very least, just have the execute
	 * function return different values (error codes), and then we can call upon command.usage based on
	 * what execute returns.
	 */
	/*if (args.length < command.argsMin || (command.argsMax !== -1 && args.length > command.argsMax))
		return message.channel.send(`Invalid number of arguments, see \`${prefix}help ${command.name}\`.`);

	if (!cooldowns.has(command.name)) {
		cooldowns.set(command.name, new Collection());
	}

	const now = Date.now();
	const timestamps = cooldowns.get(command.name);
	const cooldownAmount = (command.cooldown || 0) * 1000;

	if (timestamps.has(message.author.id)) {
		const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

		if (message.channel.type !== 'dm' && !message.member.permissions.any(permWhitelist)) {
			if (now < expirationTime) {
				const timeLeft = (expirationTime - now) / 1000;
				return message.reply(`please wait ${timeLeft.toFixed(1)} more second(s) before reusing the ${command.name} command.`);
			}
		}
	}

	timestamps.set(message.author.id, now);
	// TODO: Client#setTImeout has been removed, need to find new way to implement command cooldown system, or abandon it!
	setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

	try {
		command.old_execute(message, args, settings); // attempts to execute command
	} catch (error) {
		console.error(error);
		message.reply('there was an error trying to execute that command!'); // error message for user
	}
});*/

// login with token
client.login(process.env.DISCORD_TOKEN);
