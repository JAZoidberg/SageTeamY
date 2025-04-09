import { BOT, CHANNELS, DB, MAP_KEY } from '@root/config';
import { AttachmentBuilder, ChannelType, Client, EmbedBuilder, TextChannel } from 'discord.js';
import { schedule } from 'node-cron';
import { Reminder } from '@lib/types/Reminder';
import { Poll, PollResult } from '@lib/types/Poll';
import { MongoClient } from 'mongodb';
import { Job } from '../lib/types/Job';
import fetchJobListings from '../lib/utils/jobUtils/Adzuna_job_search';
import { sendToFile } from '../lib/utils/generalUtils';
import { JobData } from '../lib/types/JobData';
import { Interest } from '../lib/types/Interest';
import { JobResult } from '../lib/types/JobResult';
import { JobPreferences } from '../lib/types/JobPreferences';
import axios from 'axios';

async function register(bot: Client): Promise<void> {
	schedule('0/30 * * * * *', () => {
		handleCron(bot).catch(async (error) => bot.emit('error', error));
	});
}

async function handleCron(bot: Client): Promise<void> {
	checkPolls(bot);
	checkReminders(bot);
}

async function checkPolls(bot: Client): Promise<void> {
	const polls: Poll[] = await bot.mongo.collection<Poll>(DB.POLLS).find({ expires: { $lte: new Date() } }).toArray();
	const emotes = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
	polls.forEach(async (poll) => {
		const mdTimestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;
		const resultMap = new Map<string, number>();
		let winners: PollResult[] = [];

		poll.results.forEach((res) => {
			resultMap.set(res.option, res.users.length);
			if (!winners[0]) {
				winners = [res];
				return;
			}
			if (winners[0] && res.users.length > winners[0].users.length) {
				winners = [res];
			} else if (res.users.length === winners[0].users.length) {
				winners.push(res);
			}
		});

		let winMessage: string;
		const winCount = winners[0].users.length;
		if (winCount === 0) {
			winMessage = 'It looks like no one has voted!';
		} else if (winners.length === 1) {
			winMessage = `**${winners[0].option}** has won the poll with ${winCount} vote${winCount === 1 ? '' : 's'}!`;
		} else {
			winMessage = `**${winners.slice(0, -1).map((win) => win.option).join(', ')} and ${
				winners.slice(-1)[0].option
			}** have won the poll with ${winCount} vote${winCount === 1 ? '' : 's'} each!`;
		}

		let choiceText = '';
		let count = 0;
		resultMap.forEach((value, key) => {
			choiceText += `${emotes[count++]} ${key}: ${value} vote${value === 1 ? '' : 's'}\n`;
		});

		const pollChannel = await bot.channels.fetch(poll.channel);
		if (pollChannel.type !== ChannelType.GuildText) {
			throw 'something went wrong fetching the poll\'s channel';
		}

		const pollMsg = await pollChannel.messages.fetch(poll.message);
		const owner = await pollMsg.guild.members.fetch(poll.owner);
		const pollEmbed = new EmbedBuilder().setTitle(poll.question).setDescription(`This poll was created by ${owner.displayName} and ended **${mdTimestamp}**`).addFields({ name: `Winner${winners.length
			=== 1 ? '' : 's'}`, value: winMessage }).addFields({ name: 'Choices', value: choiceText }).setColor('Random');

		pollMsg.edit({ embeds: [pollEmbed], components: [] });

		pollMsg.channel.send({
			embeds: [
				new EmbedBuilder().setTitle(poll.question).setDescription(`${owner}'s poll has ended!`).addFields({ name: `Winner${winners.length === 1 ? '' : 's'}`, value: winMessage }).addFields({ name:
					'Original poll', value: `Click [here](${pollMsg.url}) to see the original poll.` }).setColor('Random')
			]
		});

		await bot.mongo.collection<Poll>(DB.POLLS).findOneAndDelete(poll);
	});
}

// eslint-disable-next-line no-warning-comments
async function getJobFormData(userID:string, filterBy: string):Promise<[JobData, Interest, JobResult[]]> {
	const client = await MongoClient.connect(DB.CONNECTION, { useUnifiedTopology: true });
	const db = client.db(BOT.NAME).collection(DB.USERS);
	const jobformAnswers: JobPreferences | null = (await db.findOne({ discordId: userID }))?.jobPreferences;
	const jobData: JobData = {
		city: jobformAnswers.answers.city,
		preference: jobformAnswers.answers.workType,
		jobType: jobformAnswers.answers.employmentType,
		distance: jobformAnswers.answers.travelDistance,
		filterBy: 'default'
	};

	const interests: Interest = {
		interest1: jobformAnswers.answers.interest1,
		interest2: jobformAnswers.answers.interest2,
		interest3: jobformAnswers.answers.interest3,
		interest4: jobformAnswers.answers.interest4,
		interest5: jobformAnswers.answers.interest5
	};

	const APIResponse:JobResult[] = await fetchJobListings(jobData, interests);
	return [jobData, interests, APIResponse];
}

function formatCurrency(currency:number): string {
	return isNaN(currency) ? 'N/A' : `${new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	}).format(Number(currency))}`;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const toRadians = (degrees: number) => degrees * (Math.PI / 180);

	const R = 3958.8; // Radius of the Earth in miles
	const dLat = toRadians(lat2 - lat1);
	const dLon = toRadians(lon2 - lon1);
	const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = (lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0) ? -1 : R * c;
	return distance;
}

async function queryCoordinates(location: string): Promise<{lat: number, lng: number}> {
	const preferredCity = encodeURIComponent(location);

	const baseURL = `https://maps.google.com/maps/api/geocode/json?address=${preferredCity}&components=country:US&key=${MAP_KEY}`;
	const response = await axios.get(baseURL);
	const coordinates : {lat: number, lng: number } = {
		lat: response.data.results[0].geometry.location.lat,
		lng: response.data.results[0].geometry.location.lng
	};

	return coordinates;
}

function titleCase(jobTitle:string): string {
	return jobTitle.toLowerCase().replace(/[()]/g, '').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function listJobs(jobForm: [JobData, Interest, JobResult[]], filterBy: string): Promise<string> {
	// Conditionally sort jobs by salary if sortBy is 'salary'
	const cityCoordinates = await queryCoordinates(jobForm[0].city);

	if (filterBy === 'salary') {
		jobForm[2].sort((a, b) => {
			const avgA = (Number(a.salaryMax) + Number(a.salaryMin)) / 2;
			const avgB = (Number(b.salaryMax) + Number(b.salaryMin)) / 2;

			// Handle cases where salaryMax or salaryMin is "Not listed"
			if (isNaN(avgA)) return 1; // Treat jobs with no salary info as lowest
			if (isNaN(avgB)) return -1;

			return avgB - avgA; // Descending order
		});
	} else if (filterBy === 'alphabetical') {
		jobForm[2].sort((a, b) => (a.title > b.title ? 1 : -1));
	} else if (filterBy === 'date') {
		jobForm[2].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
	} else if (filterBy === 'distance') {
		// cityCoordinates = await this.queryCoordinates(jobForm[0].city);

		jobForm[2].sort((a, b) => {
			const distanceA = calculateDistance(cityCoordinates.lat, cityCoordinates.lng, Number(a.latitude), Number(a.longitude));
			const distanceB = calculateDistance(cityCoordinates.lat, cityCoordinates.lng, Number(b.latitude), Number(b.longitude));

			if (distanceA === -1) {
				return 1; // Treat jobs with no location as lowest
			}

			return distanceA - distanceB; // Might have to account for negative distances
		});
	}



	let jobList = '';
	for (let i = 0; i < jobForm[2].length; i++) {
		const avgSalary = (Number(jobForm[2][i].salaryMax) + Number(jobForm[2][i].salaryMin)) / 2;
		const formattedAvgSalary = formatCurrency(avgSalary);
		const formattedSalaryMax = formatCurrency(Number(jobForm[2][i].salaryMax)) !== 'N/A' ? formatCurrency(Number(jobForm[2][i].salaryMax)) : '';
		const formattedSalaryMin = formatCurrency(Number(jobForm[2][i].salaryMin)) !== 'N/A' ? formatCurrency(Number(jobForm[2][i].salaryMin)) : '';
		const jobDistance = calculateDistance(cityCoordinates.lat, cityCoordinates.lng, Number(jobForm[2][i].latitude), Number(jobForm[2][i].longitude));
		const formattedDistance = (jobDistance !== -1) ? `${jobDistance.toFixed(2)} miles` : 'N/A';

		const salaryDetails = (formattedSalaryMin && formattedSalaryMax)
			? `, Min: ${formattedSalaryMin}, Max: ${formattedSalaryMax}`
			: formattedAvgSalary;

		jobList += `${i + 1}. **${jobForm[2][i].title}**  
		  \t\t* **Salary Average:** ${formattedAvgSalary}${salaryDetails}  
		  \t\t* **Location:** ${jobForm[2][i].location}  
		  \t\t* **Date Posted:** ${new Date(jobForm[2][i].created).toDateString()} at ${new Date(jobForm[2][i].created).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
		  \t\t* **Apply here:** [read more about the job and apply here](${jobForm[2][i].link})  
		  \t\t* **Distance:** ${formattedDistance}
		  ${i !== jobForm[2].length - 1 ? '\n' : ''}`;
	}

	return jobList || '### Unfortunately, there were no jobs found based on your interests :(. Consider updating your interests or waiting until something is found.';
}

export async function jobMessage(reminder: Reminder | string, userID: string): Promise<string> {
	const jobFormData: [JobData, Interest, JobResult[]] = await getJobFormData(userID, typeof reminder === 'object' && 'filterBy' in reminder ? reminder.filterBy : 'default');
	const filterBy = typeof reminder === 'object' && 'filterBy' in reminder ? String((reminder as Reminder).filterBy) : String(reminder);
	const message = `## Hey <@${userID}>!  
	## Here's your list of job/internship recommendations:  
Based on your interests in **${jobFormData[1].interest1}**, **${jobFormData[1].interest2}**, \
**${jobFormData[1].interest3}**, **${jobFormData[1].interest4}**, and **${jobFormData[1].interest5}**, I've found these jobs you may find interesting. Please note that while you may get\
job/internship recommendations from the same company,\
their positions/details/applications/salary WILL be different and this is not a glitch/bug!
Here's your personalized list:

	${await listJobs(jobFormData, filterBy)}
	---  
	### **Disclaimer:**  
	-# Please be aware that the job listings displayed are retrieved from a third-party API. \
	While we strive to provide accurate information, we cannot guarantee the legitimacy or security\
	of all postings. Exercise caution when sharing personal information, submitting resumes, or registering\
	on external sites. Always verify the authenticity of job applications before proceeding. Additionally, \
	some job postings may contain inaccuracies due to API limitations, which are beyond our control. We apologize for any inconvenience this may cause and appreciate your understanding.
	`;
	return message;
}

export function stripMarkdown(message: string, owner: string): string {
	return message
		.replace(new RegExp(`## Hey <@${owner}>!\\s*## Here's your list of job/internship recommendations:?`, 'g'), '') // Remove specific header
		.replace(/\[read more about the job and apply here\]/g, '')
		.replace(/\((https?:\/\/[^\s)]+)\)/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/##+\s*/g, '')
		// eslint-disable-next-line no-useless-escape
		.replace(/###|-\#\s*/g, '')
		.trim();
}

export function headerMessage(owner:string, filterBy:string):string {
	return `## Hey <@${owner}>!  
	### **__Please read this disclaimer before reading your list of jobs/internships__:**  
-# Please be aware that the job listings displayed are retrieved from a third-party API. \
While we strive to provide accurate information, we cannot guarantee the legitimacy or security \
of all postings. Exercise caution when sharing personal information, submitting resumes, or registering \
on external sites. Always verify the authenticity of job applications before proceeding. Additionally, \
some job postings may contain inaccuracies due to API limitations, which are beyond our control. We apologize for any inconvenience this may cause and appreciate your understanding.
## Here's your list of job/internship recommendations${filterBy && filterBy !== 'default' ? ` (filtered based on ${filterBy === 'date' ? 'date posted' : filterBy}):` : ':'}
	`;
}

async function checkReminders(bot: Client): Promise<void> {
	const reminders: Reminder[] = await bot.mongo.collection(DB.REMINDERS).find({ expires: { $lte: new Date() } }).toArray();
	const pubChan = (await bot.channels.fetch(CHANNELS.SAGE)) as TextChannel;

	reminders.forEach((reminder) => {
		if (reminder.mode === 'public') {
			pubChan.send(`<@${reminder.owner}>, here's the reminder you asked for: **${reminder.content}**`);
		} else {
			bot.users.fetch(reminder.owner).then(async (user) => {
				const message = await jobMessage(reminder, user.id);
				if (message.length < 2000) {
					user.send(message).catch((err) => {
						console.log('ERROR:', err);
						pubChan.send(
							`<@${reminder.owner}>, I tried to send you a DM about your private reminder but it looks like you have DMs closed. Please enable DMs in the future if 
							you'd like to get private reminders.`
						);
					});
				} else {
					const attachments: AttachmentBuilder[] = [];
					attachments.push(await sendToFile(stripMarkdown(message.split('---')[0], reminder.owner), 'txt', 'list-of-jobs-internships', false));
					user.send({ content: headerMessage(reminder.owner, reminder.filterBy), files: attachments as AttachmentBuilder[] });
				}
			}).catch((error) => {
				console.log('ERROR CALLED ----------------------------------------------------');
				console.error(`Failed to fetch user with ID: ${reminder.owner}`, error);
			});
		}

		const newReminder: Reminder = {
			content: reminder.content,
			expires: new Date(reminder.expires),
			mode: reminder.mode,
			repeat: reminder.repeat,
			owner: reminder.owner
		};

		if (reminder.repeat === 'daily') {
			newReminder.expires.setDate(reminder.expires.getDate() + 1);
			bot.mongo.collection(DB.REMINDERS).findOneAndReplace(reminder, newReminder);
		} else if (reminder.repeat === 'weekly') {
			newReminder.expires.setDate(reminder.expires.getDate() + 7);
			bot.mongo.collection(DB.REMINDERS).findOneAndReplace(reminder, newReminder);
		} else {
			bot.mongo.collection(DB.REMINDERS).findOneAndDelete(reminder);
		}
	});
}

export default register;
