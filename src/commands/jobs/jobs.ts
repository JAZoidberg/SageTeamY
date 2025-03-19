import { ApplicationCommandOptionData, ApplicationCommandOptionType, AttachmentBuilder, ChatInputCommandInteraction, EmbedBuilder, InteractionResponse } from 'discord.js';
import fetchJobListings from '@root/src/lib/utils/jobUtils/Adzuna_job_search';
import { JobResult } from '@root/src/lib/types/JobResult';
import { Interest } from '@root/src/lib/types/Interest';
import { JobData } from '@root/src/lib/types/JobData';
import { Command } from '@lib/types/Command';
import { DB, BOT, MAP_KEY } from '@root/config';
import { Job } from '@root/src/lib/types/Job';
import { MongoClient } from 'mongodb';
import { sendToFile } from '@root/src/lib/utils/generalUtils';
import axios from 'axios';


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
				{name: 'Distance', value: 'distance' }
			]
		}
	]

	// options: ApplicationCommandOptionData[] = [
	// 	{
	// 		name: 'question',
	// 		description: 'The question you want to ask',
	// 		type: ApplicationCommandOptionType.String,
	// 		required: true
	// 	}
	// ]


	async run(interaction: ChatInputCommandInteraction): Promise<void | InteractionResponse<boolean>> {
		const userID = interaction.user.id;

		const client = await MongoClient.connect(DB.CONNECTION, { useUnifiedTopology: true });
		const db = client.db(BOT.NAME).collection(DB.JOB_FORMS);
		const jobformAnswers:Job[] = await db.find({ owner: userID }).toArray();
		// const jobData:JobData = {
		// 	city: jobformAnswers[0].answers[0],
		// 	preference: jobformAnswers[0].answers[1],
		// 	jobType: jobformAnswers[0].answers[2],
		// 	distance: jobformAnswers[0].answers[3],
		// 	// filterBy: filterBy ?? 'default'
		// 	filterBy: 'default'
		// };

		// const interests:Interest = {
		// 	interest1: jobformAnswers[1].answers[0],
		// 	interest2: jobformAnswers[1].answers[1],
		// 	interest3: jobformAnswers[1].answers[2],
		// 	interest4: jobformAnswers[1].answers[3],
		// 	interest5: jobformAnswers[1].answers[4]
		// };

		const jobData: JobData = {
			city: 'New York',
			preference: 'Biology',
			jobType: 'Full Time',
			distance: '10',
			filterBy: 'date'
		};

		const interests: Interest = {
			interest1: 'Construction',
			interest2: 'Engineer',
			interest3: 'Full Time',
			interest4: 'New York',
			interest5: '10'
		};


		const APIResponse:JobResult[] = await fetchJobListings(jobData, interests);
		const results = [jobData, interests, APIResponse];
		const jobFormData: [JobData, Interest, JobResult[]] = [jobData, interests, APIResponse];
		const filterBy = interaction.options.getString('filter') ?? 'default';

		let message = `## Hey <@${userID}>!  
			## Here's your list of job/internship recommendations:  
Based on your interests in **${jobFormData[1].interest1}**, **${jobFormData[1].interest2}**, \
**${jobFormData[1].interest3}**, **${jobFormData[1].interest4}**, and **${jobFormData[1].interest5}**, I've found these jobs you may find interesting. Please note that while you may get\
job/internship recommendations from the same company,\
their positions/details/applications/salary WILL be different and this is not a glitch/bug!
Here's your personalized list:

			${this.listJobs(jobFormData[2], filterBy)}
			
			---  
			### **Disclaimer:**  
			-# Please be aware that the job listings displayed are retrieved from a third-party API. \
			While we strive to provide accurate information, we cannot guarantee the legitimacy or security\
			of all postings. Exercise caution when sharing personal information, submitting resumes, or registering\
			on external sites. Always verify the authenticity of job applications before proceeding. Additionally, \
			some job postings may contain inaccuracies due to API limitations, which are beyond our control. We apologize for any inconvenience this may cause and appreciate your understanding.
			`;

		const attachments: AttachmentBuilder[] = [];
		if (message.length > 2000) {
			// message = `${message.substring(0, 1997)}...;

			attachments.push(await sendToFile(this.stripMarkdown(message.split('---')[0], userID), 'txt', 'list-of-jobs-internships', false));
			// interaction.user.send({ content: this.headerMessage(userID, 'default'), files: attachments as AttachmentBuilder[] });
		}

		const pubChan = interaction.channel;
		if (pubChan) {
			// pubChan.send({ content: message });
			pubChan.send({ content: this.headerMessage(userID, filterBy), files: attachments as AttachmentBuilder[] });
		} else {
			console.error('Channel not found');
		}
	}

	listJobs(jobData: JobResult[], filterBy: string): string {
		// Conditionally sort jobs by salary if sortBy is 'salary'
		if (filterBy === 'salary') {
			jobData.sort((a, b) => {
				const avgA = (Number(a.salaryMax) + Number(a.salaryMin)) / 2;
				const avgB = (Number(b.salaryMax) + Number(b.salaryMin)) / 2;

				// Handle cases where salaryMax or salaryMin is "Not listed"
				if (isNaN(avgA)) return 1; // Treat jobs with no salary info as lowest
				if (isNaN(avgB)) return -1;

				return avgB - avgA; // Descending order
			});
		} else if (filterBy === 'alphabetical') {
			jobData.sort((a, b) => (a.title > b.title ? 1 : -1));
		}
		else if (filterBy === 'date') {
			jobData.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
		}
		else if (filterBy === 'distance') {
			jobData.sort((a, b) => {
				const distanceA = this.calculateDistance(Number(a.latitude), Number(a.longitude), Number(a.latitude), Number(a.longitude));
				const distanceB = this.calculateDistance(Number(b.latitude), Number(b.longitude), Number(b.latitude), Number(b.longitude));
				return distanceA - distanceB;
			});
		}



		let jobList = '';
		for (let i = 0; i < jobData.length; i++) {
			const avgSalary = (Number(jobData[i].salaryMax) + Number(jobData[i].salaryMin)) / 2;
			const formattedAvgSalary = this.formatCurrency(avgSalary);
			const formattedSalaryMax = this.formatCurrency(Number(jobData[i].salaryMax)) !== 'N/A' ? this.formatCurrency(Number(jobData[i].salaryMax)) : '';
			const formattedSalaryMin = this.formatCurrency(Number(jobData[i].salaryMin)) !== 'N/A' ? this.formatCurrency(Number(jobData[i].salaryMin)) : '';

			const salaryDetails = (formattedSalaryMin && formattedSalaryMax)
				? `, Min: ${formattedSalaryMin}, Max: ${formattedSalaryMax}`
				: formattedAvgSalary;

			jobList += `${i + 1}. **${jobData[i].title}**  
			  \t\t* **Salary Average:** ${formattedAvgSalary}${salaryDetails}  
			  \t\t* **Location:** ${jobData[i].location}  
			  \t\t* **Date Posted:** ${new Date(jobData[i].created).toDateString()} at ${new Date(jobData[i].created).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
			  \t\t* **Apply here:** [read more about the job and apply here](${jobData[i].link})  
			  \t\t* **Distance:** ${this.calculateDistance(Number(jobData[i].latitude), Number(jobData[i].longitude), Number(jobData[i].latitude), Number(jobData[i].longitude))} miles
			  ${i !== jobData.length - 1 ? '\n' : ''}`;
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

		const R = 3958.8; // Radius of the Earth in miles
		const dLat = toRadians(lat2 - lat1);
		const dLon = toRadians(lon2 - lon1);
		const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
			Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const distance = R * c;

		return distance;
	}

	async queryCoordinates(location: string): Promise<any> { // Change to appropriate type later
		const preferredCity = encodeURIComponent(location);

		const baseURL = 'https://maps.google.com/maps/api/geocode/json?address=${preferredCity}&components=country:US&key=${MAP_KEY}';
		const response = await axios.get(baseURL);
		const coordinates : {lat: number, lng: number } = {
			lat: response.data.results[0].geometry.location.lat,
			lng: response.data.results[0].geometry.location.lng
		};

		return coordinates;
	}

}
