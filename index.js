const fs = require('fs'); // Node's native file system module
const Discord = require('discord.js'); // Discord.js library - wrapper for Discord API
const Keyv = require('keyv'); // Key-Value database

// Bot config file
//  - prefix: Command prefix for messages directed at bot
//  - token:  Discord token for bot login
const { prefix, token, dbUser, dbPass } = require('./config.json');

// Setup Database
const botRoles = new Keyv(`redis://${dbUser}:${dbPass}@localhost:6379`, { namespace: 'botRoles' });
const categories = new Keyv(`redis://${dbUser}:${dbPass}@localhost:6379`, { namespace: 'categories' });
const react = new Keyv(`redis://${dbUser}:${dbPass}@localhost:6379`, { namespace: 'react' });
botRoles.on('error', err => console.log('Connection Error', err));
categories.on('error', err => console.log('Connection Error', err));
react.on('error', err => console.log('Connection Error', err));

let settings = new Map();
settings.set('botRoles', botRoles);
settings.set('categories', categories);
settings.set('react', react);

const client = new Discord.Client({ partials: ['MESSAGE', 'REACTION'] }); // register Discord client
client.commands = new Discord.Collection(); // Create commands property as a JS collection
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js')); // Get an array of all commands.

// Load each .js command file
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);

	// set a new item in the Collection
	// with the key as the command name and the value as the exported module
	client.commands.set(command.name, command);
}

const cooldowns = new Discord.Collection();
const permWhitelist = ['ADMINISTRATOR']; // Users with these permissions will not be subject to the cooldown.

// Execute first time ready event is received only
client.once('ready', () => {
	console.log(`Logged in as ${client.user.tag}, and ready to serve.`);
	client.user.setPresence({ activity: { name: `${prefix}help`, type: 'LISTENING' }, status: 'online' });

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
					await guild.channels.resolve(manager.reactor.channel)
						.messages.fetch(manager.reactor.message);
				}

				// Cache all class react-role messages
				manager.fields.forEach(async function (field) {
					if (field.reactor.channel &&
						field.reactor.message &&
						!guild.channels.resolve(field.reactor.channel)
							.messages.cache.has(field.reactor.message)) {
						await guild.channels.resolve(field.reactor.channel)
							.messages.fetch(field.reactor.message);
					}
				})
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

				if (!member.roles.cache.has(fieldRole.id))
					return;
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
				})
			.catch(console.error)
		})
	.catch(console.error);
});

// Handle messages from users (requires channel read permission)
client.on('message', message => {
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
			return message.channel.send(`These are the available commands, say \`${prefix}help <commandName>\` to see help for that command:\n\`\`\`\n${cmdList.join('\n')}\n\`\`\`\nYou may also check the documentation on the Wiki: https://gitlab.com/Magicrafter13/stembot/-/wikis/home\nAnd request features or submit bugs here: <https://gitlab.com/Magicrafter13/stembot/-/issues>`);
		}
	}

	// Handle normal commands
	// Recommend the cooldown code is moved inside the try-catch area, just to be safe
	if (!client.commands.has(commandName)) return;

	const command = client.commands.get(commandName);

	if (!command) return; // No command called 'commandName' exists

	if (command.guildOnly && message.channel.type === 'dm')
		return message.reply('This command cannot be used in a DM.');

	/*
	 * May not actually go this route, as I plan to make some more complex commands, and I feel it may be
	 * easier to handle the usage output from the command file. At the very least, just have the execute
	 * function return different values (error codes), and then we can call upon command.usage based on
	 * what execute returns.
	 */
	if (args.length < command.argsMin || (command.argsMax !== -1 && args.length > command.argsMax))
		return message.channel.send(`Invalid number of arguments, see \`${prefix}help ${command.name}\`.`);

	if (!cooldowns.has(command.name)) {
		cooldowns.set(command.name, new Discord.Collection());
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
	setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

	try {
		command.execute(message, args, settings); // attempts to execute command
	} catch (error) {
		console.error(error);
		message.reply('there was an error trying to execute that command!'); // error message for user
	}
});

// login with token
client.login(token);
