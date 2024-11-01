export interface Job {
	owner: string;
	questionSet: int;
	content: string;
	location: string;
	questionSet: int;
	answers: string[];
	mode: 'public' | 'private';
}
