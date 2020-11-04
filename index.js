// Private config file
const { prefix, token } = require('./config.json');
// Discord.js library - create Discord object
const Discord = require('discord.js');
// Register Discord client
const client = new Discord.Client();

// Execute when client ready.
client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
	if (msg.content === `${prefix}ping`) {
		msg.reply('Pong!');
	}
});

// Login with token
client.login(token);
