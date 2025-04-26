const fs = require('fs');
const { REST, Routes } = require('discord.js');
const { clientId, guildIds, token } = require('./config.json');

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

const rest = new REST().setToken(token);

for (const guild of guildIds) {
	rest.put(Routes.applicationGuildCommands(clientId, guild), { body: commands })
		.then(() => console.log(`Successfully registered application commands in guild ${guild}.`))
		.catch(console.error);
}
