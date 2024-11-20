import { APP_ID, APP_KEY } from '@root/config';
import { Interest, JobData } from '@root/src/pieces/tasks';

export interface JobResult {
	company: string,
	title: string,
	description: string,
	location,
	created: string,
	salaryMax: string,
	salaryMin: string,
	link: string,
}

export default async function getJobAPIResponse(jobData: JobData, interests: Interest): Promise<JobResult[]> {
	const LOCATION = encodeURIComponent(jobData.city);
	const JOB_TYPE = encodeURIComponent(jobData.jobType);
	const DISTANCE_KM = Number(jobData.distance) * 1.609; // miles in km
	let whatInterests = '';

	const keys = Object.keys(interests);
	const lastKey = keys[keys.length - 1];
	const lastValue = interests[lastKey];

	for (const interest in interests) {
		whatInterests += interests[interest].replace(/\s+/g, '-'); // replaces each space in a word with a dash
		if (interests[interest] !== lastValue) {
			whatInterests += ' ';
		}
	}

	whatInterests = encodeURIComponent(whatInterests);

	const URL = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${APP_ID}&app_key=${APP_KEY}&results_per_page=7&what=${JOB_TYPE}&what_or=${whatInterests}&where=
    ${LOCATION}&distance=${DISTANCE_KM}`;

	const jobResults: JobResult[] = [];

	try {
		const response = await fetch(URL);
		if (!response.ok) {
			throw new Error(`HTTP error ${response.status}`);
		}

		const responseData = await response.json();
		for (let i = 0; i < responseData.results.length; i++) {
			const jobResultData: JobResult = {
				company: responseData.results[i].company.display_name,
				title: responseData.results[i].title,
				description: responseData.results[i].description,
				location: `${responseData.results[i].location.display_name} (${responseData.results[i].location.area.toString().replace(/,/g, ', ')})`,
				created: responseData.results[i].created,
				salaryMax: responseData.results[i].salary_max,
				salaryMin: responseData.results[i].salary_min,
				link: responseData.results[i].redirect_url
			};

			if (!jobResults.find((job: JobResult) => job.company === jobResultData.company)) {
				jobResults.push(jobResultData);
			}
		}
	} catch (error) {
		console.error('Fetch error:', error);
	}

	return jobResults;
}
