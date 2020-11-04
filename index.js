const fs = require('fs'); // Node's native file system module
const Discord = require('discord.js'); // Discord.js library - wrapper for Discord API

// Bot config file
//  - prefix: Command prefix for messages directed at bot
//  - token:  Discord token for bot login
const { prefix, token } = require('./config.json');

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

// Execute first time ready event is received only
client.once('ready', () => {
	console.log(`Logged in as ${client.user.tag}, and ready to serve.`);
});

// Handle messages from users (requires channel read permission)
client.on('message', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return; // checks for prefix

	const args = message.content.slice(prefix.length).trim().split(/ +/); // looks for arguments and assigns them
	const command = args.shift().toLowerCase(); // takes command and makes it lowercase/assigns it to variable

	if (!client.commands.has(command)) return;

	try {
		client.commands.get(command).execute(message, args); // attempts to execute command
	} catch (error) {
		console.error(error); // error mesage for console
		message.reply('there was an error trying to execute that command!'); // error message for user
	}
});

// login with token
client.login(token);
