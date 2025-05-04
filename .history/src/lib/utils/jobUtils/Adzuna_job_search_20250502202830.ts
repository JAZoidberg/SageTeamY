import axios from 'axios';
import { APP_ID, APP_KEY } from '@root/config';
import { JobData } from '../../types/JobData';
import { Interest } from '../../types/Interest';
import { JobListing } from '../../types/JobListing';
import { JobResult } from '../../types/JobResult';
import { AdzunaJobResponse } from '../../types/AdzunaJobResponse';

type JobCache = {
	[key: string]: JobListing[] | JobResult[];
};

const jobCache: JobCache = {};

//fixes the /job command
export default async function fetchJobListings(jobData: JobData, interests?: Interest): Promise<JobResult[]> {
	// Make sure city and jobType exist; use defaults if not
	const safeCity = jobData.city?.toLowerCase?.() || 'newark';
	const safeJobType = jobData.jobType?.toLowerCase?.() || 'full-time';
	const safeDistanceKm = Number(jobData.distance || 10) * 1.609; // Default to 10 miles if distance is missing

	const LOCATION = encodeURIComponent(safeCity);
	const JOB_TYPE = encodeURIComponent(safeJobType);

	// Format interests into a string for the query
	let whatInterests = '';
	if (interests) {
		const keys = Object.keys(interests);
		const lastKey = keys[keys.length - 1];
		const lastValue = interests[lastKey];

		for (const interest in interests) {
			// If interest is undefined, skip it
			whatInterests += interests[interest]?.replace(/\s+/g, '-') || '';
			if (interests[interest] !== lastValue) {
				whatInterests += ' ';
			}
		}
	}
	whatInterests = encodeURIComponent(whatInterests);

	// Use safe values in the cache key
	const cacheKey = `${safeJobType}-${safeCity}-${whatInterests}`;
	if (jobCache[cacheKey]) {
		console.log('Fetching data from cache...');
		return jobCache[cacheKey] as JobResult[];
	}

	// Build base API URL
	const URL_BASE = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${APP_ID}&app_key=${APP_KEY}&results_per_page=15&what=${JOB_TYPE}&what_or=${whatInterests}&where=${LOCATION}&distance=${Math.round(safeDistanceKm)}`;

	try {
		// If a sorting method is given and not "default", add it to the URL
		const url = jobData.filterBy && jobData.filterBy !== 'default'
			? `${URL_BASE}&sort_by=${jobData.filterBy}`
			: URL_BASE;

		const response = await axios.get(url);

		// Map Adzuna response to our JobResult format
		const jobResults: JobResult[] = response.data.results.map((job: AdzunaJobResponse) => ({
			company: job.company?.display_name || 'Not Provided',
			title: job.title,
			description: job.description || 'No description available',
			location: `${job.location?.display_name || 'Not Provided'} (${job.location?.area?.toString().replace(/,/g, ', ') || ''})`,
			created: job.created || 'Unknown',
			salaryMax: job.salary_max || 'Not listed',
			salaryMin: job.salary_min || 'Not listed',
			link: job.redirect_url || 'No link available',
			longitude: job.longitude || 0,
			latitude: job.latitude || 0
		}));

		return jobResults.sort();
	} catch (error) {
		console.error('API error:', error);
		throw error;
	}
}
