import { ApplicationCommandOptionData, ApplicationCommandOptionType, AttachmentBuilder, ChatInputCommandInteraction, InteractionResponse } from 'discord.js';
import fetchJobListings from '@root/src/lib/utils/jobUtils/Adzuna_job_search';
import { JobResult } from '@root/src/lib/types/JobResult';
import { Interest } from '@root/src/lib/types/Interest';
import { JobData } from '@root/src/lib/types/JobData';
import { goalStrength } from '@root/src/lib/types/goalStrength';
import { Command } from '@lib/types/Command';
import { DB, BOT, MAP_KEY } from '@root/config';
import { MongoClient } from 'mongodb';
import { sendToFile } from '@root/src/lib/utils/generalUtils';
import axios from 'axios';
import { JobPreferences } from '@root/src/lib/types/JobPreferences';
import jobform from './jobform';


export default class extends Command {

	description = `Get a listing of jobs based on your interests and preferences.`;
	extendedHelp = `This command will return a listing of jobs based on your interests and preferences.`;

	options: ApplicationCommandOptionData[] = [
		{
			name: 'filter',
			description: 'Filter options for job listings',
			type: ApplicationCommandOptionType.String,
			required: false,
			choices: [
				{ name: 'Date Posted', value: 'date' },
				{ name: 'Salary', value: 'salary' },
				{ name: 'Alphabetical', value: 'alphabetical' },
				{ name: 'Distance', value: 'distance' }
			]
		}
	]

	async run(interaction: ChatInputCommandInteraction): Promise<void | InteractionResponse<boolean>> {
		const userID = interaction.user.id;

		const client = await MongoClient.connect(DB.CONNECTION, { useUnifiedTopology: true });
		const db = client.db(BOT.NAME).collection(DB.USERS);
		const filterBy = interaction.options.getString('filter') ?? 'default';


		const jobformAnswers: JobPreferences | null = (await db.findOne({ discordId: userID }))?.jobPreferences;

		const jobData: JobData = {
			city: jobformAnswers.answers.city,
			preference: jobformAnswers.answers.workType,
			jobType: jobformAnswers.answers.employmentType,
			distance: jobformAnswers.answers.travelDistance,
			salary: jobformAnswers.answers.salary,
			filterBy: 'default'
		};

		const interests: Interest = {
			interest1: jobformAnswers.answers.interest1,
			interest2: jobformAnswers.answers.interest2,
			interest3: jobformAnswers.answers.interest3,
			interest4: jobformAnswers.answers.interest4,
			interest5: jobformAnswers.answers.interest5
		};

		const goalstrength: goalStrength = {
			strength1: jobformAnswers.answers.strength1,
			strength2: jobformAnswers.answers.strength2,
			strength3: jobformAnswers.answers.strength3,
			goal1: jobformAnswers.answers.goal1,
			goal2: jobformAnswers.answers.goal2
		};

		const APIResponse:JobResult[] = await fetchJobListings(jobData, interests, goalstrength);
		const jobFormData: [JobData, Interest, goalStrength, JobResult[]] = [jobData, interests, goalstrength, APIResponse];

		const message = `## Hey <@${userID}>!  
			## Here's your list of job/internship recommendations:  
Based on your interests in **${jobFormData[1].interest1}**, **${jobFormData[1].interest2}**, \
**${jobFormData[1].interest3}**, **${jobFormData[1].interest4}**, and **${jobFormData[1].interest5}**, as well as
your strengths **${jobFormData[2].strength1}**, **${jobFormData[2].strength2}**, **${jobFormData[2].strength3}**, and your goals
**${jobFormData[2].goal1}**, and **${jobFormData[2].goal2}**. I've found these jobs you may find interesting. Please note that while you may get\
job/internship recommendations from the same company,\
their positions/details/applications/salary WILL be different and this is not a glitch/bug!
Here's your personalized list:

			${await this.listJobs(jobFormData, filterBy)}
			
			---  
			### **Disclaimer:**  
			-# Please be aware that the job listings displayed are retrieved from a third-party API. \
			While we strive to provide accurate information, we cannot guarantee the legitimacy or security\
			of all postings. Exercise caution when sharing personal information, submitting resumes, or registering\
			on external sites. Always verify the authenticity of job applications before proceeding. Additionally, \
			some job postings may contain inaccuracies due to API limitations, which are beyond our control. We apologize for any inconvenience this may cause and appreciate your understanding.
			`;

		const attachments: AttachmentBuilder[] = [];
		const pubChan = interaction.channel;
		if (message.length > 2000) {
			attachments.push(await sendToFile(this.stripMarkdown(message.split('---')[0], userID), 'txt', 'list-of-jobs-internships', false));
			pubChan.send({ content: this.headerMessage(userID, filterBy), files: attachments as AttachmentBuilder[] });
			// interaction.user.send({ content: this.headerMessage(userID, 'default'), files: attachments as AttachmentBuilder[] });
		} else {
			pubChan.send(message);
		}
	}

	async listJobs(jobForm: [JobData, Interest, goalStrength, JobResult[]], filterBy: string): Promise<string> {
		// Conditionally sort jobs by salary if sortBy is 'salary'
		const cityCoordinates = await this.queryCoordinates(jobForm[0].city);

		if (filterBy === 'salary') {
			jobForm[3].sort((a, b) => {
				const avgA = (Number(a.salaryMax) + Number(a.salaryMin)) / 2;
				const avgB = (Number(b.salaryMax) + Number(b.salaryMin)) / 2;

				// Handle cases where salaryMax or salaryMin is "Not listed"
				if (isNaN(avgA)) return 1; // Treat jobs with no salary info as lowest
				if (isNaN(avgB)) return -1;

				return avgB - avgA; // Descending order
			});
		} else if (filterBy === 'alphabetical') {
			jobForm[3].sort((a, b) => a.title > b.title ? 1 : -1);
		} else if (filterBy === 'date') {
			jobForm[3].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
		} else if (filterBy === 'distance') {
			// cityCoordinates = await this.queryCoordinates(jobForm[0].city);

			jobForm[3].sort((a, b) => {
				const distanceA = this.calculateDistance(cityCoordinates.lat, cityCoordinates.lng, Number(a.latitude), Number(a.longitude));
				const distanceB = this.calculateDistance(cityCoordinates.lat, cityCoordinates.lng, Number(b.latitude), Number(b.longitude));

				if (distanceA === -1) {
					return 1; // Treat jobs with no location as lowest
				}

				return distanceA - distanceB; // Might have to account for negative distances
			});
		}

		let jobList = '';
		for (let i = 0; i < jobForm[3].length; i++) {
			const avgSalary = (Number(jobForm[3][i].salaryMax) + Number(jobForm[3][i].salaryMin)) / 2;
			const formattedAvgSalary = this.formatCurrency(avgSalary);
			const formattedSalaryMax = this.formatCurrency(Number(jobForm[3][i].salaryMax)) !== 'N/A' ? this.formatCurrency(Number(jobForm[3][i].salaryMax)) : '';
			const formattedSalaryMin = this.formatCurrency(Number(jobForm[3][i].salaryMin)) !== 'N/A' ? this.formatCurrency(Number(jobForm[3][i].salaryMin)) : '';
			const jobDistance = this.calculateDistance(cityCoordinates.lat, cityCoordinates.lng, Number(jobForm[3][i].latitude), Number(jobForm[3][i].longitude));
			const formattedDistance = jobDistance !== -1 ? `${jobDistance.toFixed(2)} miles` : 'N/A';

			const salaryDetails = formattedSalaryMin && formattedSalaryMax
				? `, Min: ${formattedSalaryMin}, Max: ${formattedSalaryMax}`
				: formattedAvgSalary;

			jobList += `${i + 1}. **${jobForm[3][i].title}**  
			  \t\t* **Salary Average:** ${formattedAvgSalary}${salaryDetails}  
			  \t\t* **Location:** ${jobForm[3][i].location}  
			  \t\t* **Date Posted:** ${new Date(jobForm[3][i].created).toDateString()} at ${new Date(jobForm[3][i].created).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
			  \t\t* **Apply here:** [read more about the job and apply here](${jobForm[3][i].link})  
			  \t\t* **Distance:** ${formattedDistance}
			  ${i !== jobForm[3].length - 1 ? '\n' : ''}`;
		}

		return jobList || '### Unfortunately, there were no jobs found based on your interests :(. Consider updating your interests or waiting until something is found.';
	}

	formatCurrency(currency: number): string {
		return isNaN(currency) ? 'N/A' : `${new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(Number(currency))}`;
	}


	stripMarkdown(message: string, owner: string): string {
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

	headerMessage(owner:string, filterBy:string):string {
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

	calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const toRadians = (degrees: number) => degrees * (Math.PI / 180);

		const Rad = 3958.8; // Radius of the Earth in miles
		const dLat = toRadians(lat2 - lat1);
		const dLon = toRadians(lon2 - lon1);
		const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
			Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const distance = (lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0) ? -1 : Rad * c;
		return distance;
	}

	async queryCoordinates(location: string): Promise<any> { // Change to appropriate type later
		const preferredCity = encodeURIComponent(location);

		const baseURL = `https://maps.google.com/maps/api/geocode/json?address=${preferredCity}&components=country:US&key=${MAP_KEY}`;
		const response = await axios.get(baseURL);
		const coordinates : {lat: number, lng: number } = {
			lat: response.data.results[0].geometry.location.lat,
			lng: response.data.results[0].geometry.location.lng
		};

		return coordinates;
	}

}
