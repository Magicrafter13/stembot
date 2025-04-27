const fs = require('fs');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

for (const guild of process.env.DISCORD_GUILDS.split(',')) {
	rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT, guild), { body: commands })
		.then(() => console.log(`Successfully registered application commands in guild ${guild}.`))
		.catch(console.error);
}
