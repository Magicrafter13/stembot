module.exports = {
	name: 'catman',
	description: 'Manage Class Subjects/Fields',
	guildOnly: true,
	cooldown: 0.5,
	argsMin: 1,
	argsMax: -1,
	execute(message, args, settings) {
		// Check if user has required permissions.
		const guildMember = message.guild.member(message.author);
		if (!guildMember.hasPermission('MANAGE_CHANNELS', { checkAdmin: true }) || !guildMember.hasPermission('MANAGE_ROLES', { checkAdmin: true }))
			return message.reply('You do not have adequate permissions for this command to work.\nRequires: MANAGE_CHANNELS and MANAGE_ROLES');

		const catDB = settings.get('categories');
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
				const place = categories.indexOf(catData);

				let className;

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
							message.channel.send(`Created class info for ${role.toString()}, under category ${category.toString()}.`);
						}
						else {
							catData.channel = category.id;
							categories[place] = catData;
							message.channel.send(`Updated class category to ${category.toString()}.`);
						}
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
							message.channel.send(`Created class info for ${role.toString()}, with prefix \`${prefix}\`.`);
						}
						else {
							catData.prefix = prefix;
							categories[place] = catData;
							message.channel.send(`Updated class prefix to \`${prefix}\`.`);
						}
						break;
					case '-p': case '--print':
						if (catData === undefined) return message.channel.send(`No category information set for ${role.toString()}`);

						const classes = `[ ${catData.classes.join(', ')} ]`;
						const roles = `[ ${catData.roles.map(id => message.guild.roles.cache.find(role => role.id === id).toString()).join(', ')} ]`;
						const channels = `[ ${catData.channels.map(id => message.guild.channels.cache.find(channel => channel.id === id).toString()).join(', ')} ]`;
						return message.channel.send(`${catData.channel !== undefined ? `category: ${message.guild.channels.cache.find(channel => channel.id === catData.channel).toString()}` : 'no category'}\n${catData.prefix !== undefined ? `prefix: ${catData.prefix}` : 'no prefix'}\n${classes}\n${roles}\n${channels}`);
					case '-a': case '--add':
						if (catData === undefined) return message.channel.send(`No category information set for ${role.toString()}`);
						if (catData.channel === undefined) return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
						if (catData.prefix === undefined) return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

						className = args.shift().toLowerCase();
						if (catData.classes.indexOf(className) > -1) return message.channel.send(`${role.toString()} already contains this class.`);
						const classRole = message.guild.roles.cache.find(role => role.name.startsWith(`${catData.prefix} ${className}`));
						if (classRole === undefined) return message.channel.send(`No role found with name \`${catData.prefix} ${className}\`, you can create one by using \`-c\` instead of \`-a\`.`);
						const classChannel = message.guild.channels.cache.find(channel => channel.name.startsWith(`${catData.prefix.toLowerCase()}${className}`) && channel.type === 'text')
						if (classChannel === undefined) return message.channel.send(`No channel found with name \`${catData.prefix.toLowerCase()}${className}, you can create one by using \`-c\` instead of \`-a\`.`);

						message.channel.send(`Adding ${classRole.toString()} and ${classChannel.toString()} to ${role.toString()} info.`);

						catData.classes.push(className);
						catData.roles.push(classRole.id);
						catData.channels.push(classChannel.id);
						categories[place] = catData;
						break;
					case '-c': case '--create':
						if (catData === undefined) return message.channel.send(`No category information set for ${role.toString()}`);
						if (catData.channel === undefined) return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
						if (catData.prefix === undefined) return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

						className = args.shift().toLowerCase();
						if (catData.classes.indexOf(className) > -1) return message.channel.send(`${role.toString()} already contains this class.`);

						message.guild.roles.create({
							data: {
								name: `${catData.prefix} ${className}`,
								position: catData.roles.length === 0 ? null : message.guild.roles.cache.find(role => role.id === catData.roles[catData.roles.length - 1]).position,
							},
							reason: `${message.author.username} added class ${className} to ${catData.prefix}.`,
						})
							.then(newRole => {
								message.guild.channels.create(`${catData.prefix}${className}`, {
									type: 'text',
									parent: message.guild.channels.cache.find(channel => channel.type === 'category' && channel.id === catData.channel),
									reason: `${message.author.username} added class ${className} to ${catData.prefix}.`,
								})
									.then(newChannel => {
										if (catData.channels.length)
											newChannel.setPosition(message.guild.channels.cache.find(channel => channel.id === catData.channels[catData.channels.length - 1]).rawPosition);
										message.channel.send(`Adding ${newRole.toString()} and ${newChannel.toString()} to ${role.toString()} info.`);

										catData.classes.push(className);
										catData.roles.push(newRole.id);
										catData.channels.push(newChannel.id);
										categories[place] = catData;

										catDB.set(message.guild.id, categories);
									})
								.catch(console.error);
							})
						.catch(console.error);
						return;
					case '-r': case '--remove':
						if (catData === undefined) return message.channel.send(`No category information set for ${role.toString()}`);
						if (catData.channel === undefined) return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
						if (catData.prefix === undefined) return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

						className = args.shift().toLowerCase();
						const classIndex = catData.classes.indexOf(className);
						if (classIndex === -1) return message.channel.send(`${role.toString()} doesn't contain this class.`);

						catData.classes.splice(classIndex, 1);
						catData.roles.splice(classIndex, 1);
						catData.channels.splice(classIndex, 1);
						categories[place] = catData;
						message.channel.send(`Removed \`${className}\` from list of classes.`);
						break;
					case '-d': case '--delete':
						if (catData === undefined) return message.channel.send(`No category information set for ${role.toString()}`);
						if (catData.channel === undefined) return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
						if (catData.prefix === undefined) return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

						className = args.shift().toLowerCase();
						const fieldIndex = catData.classes.indexOf(className);
						if (fieldIndex === -1) return message.channel.send(`${role.toString()} doesn't contain this class.`);

						catData.classes.splice(fieldIndex, 1);
						message.guild.roles.fetch(catData.roles.splice(fieldIndex, 1)[0])
							.then(oldRole => {
								oldRole.delete(`${message.author.username} deleted ${className} from ${catData.prefix}.`)
								.then(message.channel.send('Role deleted.'))
								.catch(console.error);
								const oldChannelID = catData.channels.splice(fieldIndex, 1)[0];
								message.channel.send(`You may now delete ${message.guild.channels.cache.find(channel => channel.id === oldChannelID).toString()}.`);
								/*message.guild.channels.cache.find(channel => channel.id === oldChannelID).delete(`${message.author.username} deleted ${className} from ${catData.prefix}.`)
								.then(message.channel.send(`Channel deleted.`))
								.catch(console.error);*/
								categories[place] = catData;
							})
						.catch(console.error);
						break;
					case '--purge':
						if (catData === undefined) return message.channel.send(`No category information set for ${role.toString()}`);

						categories.splice(place, 1);
						message.channel.send(`Erased ${role.toString()} from category info list!`);
				}
				catDB.set(message.guild.id, categories);
			})
		.catch(console.error);
	},
	help(prefix) {
		return `
${prefix}catman (-l | --list)
${prefix}catman <role> (-sc | --set-category) <category_name>
${prefix}catman <role> (-sp | --set-prefix) <prefix>
${prefix}catman <role> --purge
${prefix}catman <role> (-a | -c | -r | -d) <class_number>
${prefix}catman <role> (-p | --print)

\t-l --list           Shows the fields currently stored in the manager (roles).
\t-sc --set-category  Sets the Channel Category for this field to a category called
\t                    category_name (if one exists).
\t-sp --set-prefix    Sets the role/channel prefix for this field.
\t--purge             Deletes this field from the manager.
\t-a --add            Adds a role beginning with the field prefix, a space, and
\t                    class_number, and a channel beginning with field prefix, and
\t                    class_number.
\t-c --create         Creates a new role and channel, following the same convention
\t                    above.
\t-r --remove         Removes class_number from this field.
\t-d --delete         Removes class_number from this field, then deletes the role.
\t                    Channel must be deleted manually.
\t-p --print          Displays the information the manager has on this field.
`;
	},
}
