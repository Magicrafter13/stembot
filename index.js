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
botRoles.on('error', err => console.log('Connection Error', err));
categories.on('error', err => console.log('Connection Error', err));

let settings = new Map();
settings.set('botRoles', botRoles);
settings.set('categories', categories);

const client = new Discord.Client(); // register Discord client
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

			return message.channel.send(`${cmdQuery.name}\n  ${cmdQuery.description}\n  usage:\n\`\`\`\n${cmdQuery.help(prefix)}\n\`\`\``);
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
