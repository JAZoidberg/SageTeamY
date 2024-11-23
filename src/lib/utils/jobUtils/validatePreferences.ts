import jobform from '@root/src/commands/jobs/jobform';

interface ValidateResult {
	isValid: boolean;
	errors: string[];
}

// eslint-disable-next-line complexity
export const validatePreferences = (answers: string[], qset: number, isJobForm: boolean): ValidateResult => {
	const errors: string[] = [];
	if (qset === 0) {
		const [city, workType, employmentType, travelDistance] = answers;
		if (!isJobForm || !city?.trim()) {
			if (city?.trim() === '') {
				errors.push('Enter valid city');
			}
		}
		if (!isJobForm || !workType?.trim()) {
			const validWorkTypes = ['remote', 'hybrid', 'in person',
				'remote, hybrid', 'remote, in person', 'hybrid, in person', 'hybrid. remote', 'in person, remote', 'in person, hybrid',
				'all'
			];
			if (workType?.trim()) {
			// eslint-disable-next-line id-length
				const workTypes = workType.toLowerCase().split(',').map(t => t.trim());
				// eslint-disable-next-line id-length
				const invalidTypes = workTypes.filter(t => !validWorkTypes.includes(t));
				if (invalidTypes.length > 0) {
					errors.push(`Invalid work type: ${invalidTypes.join(', ')}. Must be remote, hybrid, and/or in person seperated only by comams. Must be all if it is all three`);
				}
			} else if (isJobForm) {
				errors.push('Enter valid work type');
			}
		}
		if (!isJobForm || !employmentType?.trim()) {
			const validEmploymentTypes = ['full time', 'part time', 'internship',
				'full time, part time', 'full time, internship', 'part time, internship', 'part time, full time', 'internship, full time', 'internship, part time',
				'all'
			];
			if (employmentType?.trim()) {
				// eslint-disable-next-line id-length
				const employmentTypes = employmentType.toLowerCase().split(',').map(t => t.trim());
				// eslint-disable-next-line id-length
				const invalidTypes = employmentTypes.filter(t => !validEmploymentTypes.includes(t));
				if (invalidTypes.length > 0) {
					errors.push(`Invalid employment type: ${invalidTypes.join(', ')}. Must be full time, part time, and/or internship seperated only by comams. Must be all if it is all three`);
				}
			} else if (isJobForm) {
				errors.push('Enter valid employment type');
			}
		}
		if (!isJobForm || (travelDistance && isNaN(Number(travelDistance.replace(/[^0-9]/g, ''))))) {
			errors.push('Travel distance must be a number');
		}
	} else if (qset === 1) {
		if (isJobForm) {
			const intersts = answers.filter(interest => interest?.trim()).length;
			if (intersts < 5) {
				errors.push('Select at least 5 interests');
			}
		}
	}
	return {
		isValid: errors.length === 0,
		errors
	};
};
