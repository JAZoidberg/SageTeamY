export interface Job {
	owner: string;
	content: string;
	location: string;
	answers: string[];
	mode: 'public' | 'private';
}
