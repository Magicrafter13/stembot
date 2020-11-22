module.exports = {
	name: 'catman',
	description: 'Field Category Manager',
	guildOnly: true,
	cooldown: 0.5,
	argsMin: 1,
	argsMax: -1,
	usage: '',
	execute(message, args, settings) {
		const catDB = settings.get('categories');

		/*catDB.set(message.guild.id, new Map())
			.then(() => {
				catDB.get(message.guild.id)
				.then(obj => console.log(obj.has('f')))
				.catch(console.error);
			})
		.catch(console.error);
		return;*/

		catDB.get(message.guild.id)
			.then(val => {
				// JSON stringify doesn't support Map objects...
				let categories = val === undefined ? [] : val;

				// Check if no arguments were provided, or first argument is list command
				if (!args.length || args[0] === '-l' || args[0] === '--list')
					return message.channel.send(`The following roles have category information:\n${val.map(arr => message.guild.roles.cache.find(role => role.id === arr.id).toString()).join('\n')}`)

				// Get role request from message
				const roleStr = args.shift();
				const role = message.guild.roles.cache.find(role => role.toString() === roleStr);
				if (!role) return message.channel.send('1st argument must be type: Role');

				// Category information for specified role
				let catData = categories.find(c => c.id === role.id);

				const cmd = args.shift();
				switch (cmd) {
					case '-sc': case '--set-category':
						const catName = args.join(' ');
						const category = message.guild.channels.cache.find(channel => channel.name === catName);
						if (!category) return message.channel.send('3rd argument must be type: Channel Category');

						if (catData === undefined) {
							categories.push({
								id: role.id,
								channel: category.id,
								prefix: undefined,
								classes: [],  // array of integers
								roles: [],    // array of role ids
								channels: [], // array of channel ids
							});
						}
						else {
							const place = categories.indexOf(catData);
							catData.channel = category.id;
							categories[place] = catData;
						}
						catDB.set(message.guild.id, categories);
						break;
					case '-sp': case '--set-prefix':
						const prefix = args.shift();

						if (catData === undefined) {
							categories.push({
								id: role.id,
								channel: undefined,
								prefix: prefix,
								classes: [],
								roles: [],
								channels: [],
							});
						}
						else {
							const place = categories.indexOf(catData);
							catData.prefix = prefix;
							categories[place] = catData;
						}
						catDB.set(message.guild.id, categories);
						break;
					case '-p': case '--print':
						if (catData === undefined) return message.channel.send(`No category information set for ${role.toString()}`);

						const classes = `[ ${catData.classes.join(', ')} ]`;
						const roles = `[ ${catData.roles.map(id => message.guild.roles.cache.find(role => role.id === id).toString()).join(', ')} ]`;
						const channels = `[ ${catData.channels.map(id => message.guild.channels.cache.find(channel => channel.id === id).toString()).join(', ')} ]`;
						message.channel.send(`${catData.channel !== undefined ? `category: ${message.guild.channels.cache.find(channel => channel.id === catData.channel).toString()}` : 'no category'}\n${catData.prefix !== undefined ? `prefix: ${catData.prefix}` : 'no prefix'}\n${classes}\n${roles}\n${channels}`);
						break;
					case '-a': case '--add':
						if (catData === undefined) return message.channel.send(`No category information set for ${role.toString()}`);
						if (catData.channel === undefined) return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
						if (catData.prefix === undefined) return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

						const newClass = args.shift().toLowerCase();
						if (catData.classes.indexOf(newClass) > -1) return message.channel.send(`${role.toString()} already contains this class.`);

						const classRole = message.guild.roles.cache.find(role => role.name.startsWith(`${catData.prefix} ${newClass}`));
						if (classRole === undefined) return message.channel.send(`No role found with name \`${catData.prefix} ${newClass}\`, you can create one by using \`-c\` instead of \`-a\`.`);

						const classChannel = message.guild.channels.cache.find(channel => channel.name.startsWith(`${catData.prefix.toLowerCase()}${newClass}`) && channel.type === 'text')
						if (classChannel === undefined) return message.channel.send(`No channel found with name \`${catData.prefix.toLowerCase()}${newClass}, you can create one by using \`-c\` instead of \`-a\`.`);

						message.channel.send(`Adding ${classRole.toString()} and ${classChannel.toString()} to ${role.toString()} info.`);

						const place = categories.indexOf(catData);
						catData.classes.push(newClass);
						catData.roles.push(classRole.id);
						catData.channels.push(classChannel.id);
						categories[place] = catData;

						catDB.set(message.guild.id, categories);
				}
			})
		.catch(console.error);
	}
}
