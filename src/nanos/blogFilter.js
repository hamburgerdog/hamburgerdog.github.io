import { atom } from 'nanostores';

export const BLOG_TAGS = [
	{
		id: 'life',
		value: '生活',
	},
	{
		id: 'programming',
		value: '编程',
	},
	{
		id: 'star',
		value: '精选',
	},
	{
		id: 'recent',
		value: '最近半年',
	},
];

export const blogFilterSet = atom(new Set());
