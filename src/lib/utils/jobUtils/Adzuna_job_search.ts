import axios from 'axios';
import { APP_ID, APP_KEY } from '@root/config';
import { JobData } from '../../types/JobData';
import { Interest } from '../../types/Interest';
import { JobResult } from '../../types/JobResult';
import { AdzunaJobResponse } from '../../types/AdzunaJobResponse';

type JobCache = { [key: string]: JobResult[] };
const jobCache: JobCache = {};

export default async function fetchJobListings(
	jobData: JobData,
	interests?: Interest
): Promise<JobResult[]> {
	// 1) Trim & sanitize inputs
	const city = jobData.city.trim();
	const jobType = jobData.jobType.trim();
	const distance = jobData.distance.trim();
	const km = Math.round(Number(distance) * 1.609);

	// 2) Build interests array
	const interestArray = interests
		? Object.values(interests)
			.map(i => i.trim())
			.filter(i => i.length > 0)
		: [];

	// 3) URL-encode params
	const WHAT = encodeURIComponent(jobType);
	const WHAT_OR = encodeURIComponent(interestArray.join(','));
	const WHERE = encodeURIComponent(city);
	const DIST = encodeURIComponent(km.toString());

	// 4) Only remote sort for date/salary
	const supported = ['date', 'salary'];
	const sortParam
    = supported.includes(jobData.filterBy)
    	? `&sort_by=${encodeURIComponent(jobData.filterBy)}`
    	: '';

	// 5) Cache key
	const cacheKey = `${jobType}|${city}|${interestArray.join(',')}|${jobData.filterBy}`;
	if (jobCache[cacheKey]) return jobCache[cacheKey];

	// 6) Build URL
	const url
    = `${`https://api.adzuna.com/v1/api/jobs/us/search/1` +
    `?app_id=${APP_ID}` +
    `&app_key=${APP_KEY}` +
    `&results_per_page=15` +
    `&what=${WHAT}` +
    `&what_or=${WHAT_OR}` +
    `&where=${WHERE}` +
    `&distance=${DIST}`}${
    	sortParam}`;

	// 7) Fetch & map
	let results: JobResult[];
	try {
		const { data } = await axios.get<{ results: AdzunaJobResponse[] }>(url);
		results = data.results.map(j => ({
			company: j.company?.display_name || 'Not Provided',
			title: j.title,
			description: j.description || 'No description available',
			location: j.location?.display_name || 'Not Provided',
			created: j.created,
			salaryMax: j.salary_max?.toString() || 'Not listed',
			salaryMin: j.salary_min?.toString() || 'Not listed',
			link: j.redirect_url,
			latitude: j.latitude || 0,
			longitude: j.longitude || 0
		}));
	} catch (err) {
		console.error('Adzuna API error:', err);
		throw err;
	}

	// 8) Client-side alphabetical sort if requested
	if (jobData.filterBy === 'alphabetical') {
		results.sort((a, b) => a.title.localeCompare(b.title));
	}

	// (distance sort removed in this version)

	// 9) Cache & return
	jobCache[cacheKey] = results;
	return results;
}
