// Node's native file system module
const fs = require('fs');
// Discord.js library - create Discord object
const Discord = require('discord.js');
// private config file
const { prefix, token } = require('./config.json');
// register Discord client
const client = new Discord.Client();
// JS's native Map class
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`); // paths to commands folder
    // set a new item in the Collection
    // with the key as the command name and the value as the exported module
	client.commands.set(command.name, command);
}

// Execute when client is ready
client.once('ready', () => {
	console.log('Ready!');
});

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
