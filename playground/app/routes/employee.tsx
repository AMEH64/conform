import { conform, useForm } from '@conform-to/react';
import { parse } from '@conform-to/zod';
import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Form, useActionData, useLoaderData } from '@remix-run/react';
import { z } from 'zod';
import { Playground, Field, Alert } from '~/components';
import { parseConfig } from '~/config';

function createSchema(
	intent: string,
	constraints: {
		isEmailUnique?: (email: string) => Promise<boolean>;
	} = {},
) {
	return z.object({
		name: z.string().min(1, 'Name is required'),
		email: z
			.string()
			.min(1, 'Email is required')
			.email('Email is invalid')
			.superRefine((value, ctx) => {
				if (intent !== 'validate/email' && intent !== 'submit') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: conform.VALIDATION_SKIPPED,
					});
				} else if (typeof constraints.isEmailUnique === 'undefined') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: conform.VALIDATION_UNDEFINED,
					});
				} else {
					// when the constraint is defined, we must return a promise
					// to declare it as an async validation
					return constraints.isEmailUnique(value).then((isUnique) => {
						if (isUnique) {
							return;
						}

						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: 'Email is already used',
						});
					});
				}
			}),
		title: z.string().min(1, 'Title is required').max(20, 'Title is too long'),
	});
}

export let loader = async ({ request }: LoaderArgs) => {
	return parseConfig(request);
};

export let action = async ({ request }: ActionArgs) => {
	const formData = await request.formData();
	const submission = await parse(formData, {
		schema: (intent) =>
			createSchema(intent, {
				isEmailUnique(email) {
					return new Promise((resolve) => {
						setTimeout(() => {
							// Only `hey@conform.guide` is unique
							resolve(email === 'hey@conform.guide');
						}, Math.random() * 500);
					});
				},
			}),
		async: true,
	});

	return json(submission);
};

export default function EmployeeForm() {
	const config = useLoaderData();
	const state = useActionData();
	const [form, { name, email, title }] = useForm({
		...config,
		state,
		onValidate({ formData }) {
			return parse(formData, {
				schema: (intent) => createSchema(intent),
			});
		},
	});

	return (
		<Form method="post" {...form.props}>
			<Playground title="Employee Form" state={state}>
				<Alert message={form.error} />
				<Field label="Name" {...name}>
					<input
						{...conform.input(name.config, { type: 'text' })}
						autoComplete="off"
					/>
				</Field>
				<Field label="Email" {...email}>
					<input
						{...conform.input(email.config, { type: 'email' })}
						autoComplete="off"
					/>
				</Field>
				<Field label="Title" {...title}>
					<input {...conform.input(title.config, { type: 'text' })} />
				</Field>
			</Playground>
		</Form>
	);
}
