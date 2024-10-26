export interface Job {
	owner: string;
	content: string;
	location: string;
	questionSet: int;
	answers: string[];
	mode: 'public' | 'private';
}
