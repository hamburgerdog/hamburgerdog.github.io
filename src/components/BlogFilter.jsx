import { useStore } from '@nanostores/preact';

import { BLOG_TAGS, blogFilterSet } from '../nanos/blogFilter';
import styles from './BlogFilter.module.scss';

export const BlogFilter = () => {
	const $filters = useStore(blogFilterSet);

	const handleFilterClick = (id) => {
		const nextFilter = new Set($filters);

		if (nextFilter.has(id)) {
			nextFilter.delete(id);
		} else {
			nextFilter.add(id);
		}

		blogFilterSet.set(nextFilter);
	};

	const render = ({ id, value }) => {
		const isSelected = $filters.has(id);

		return (
			<p
				onClick={() => handleFilterClick(id)}
				key={id}
				className={`${styles.item} ${isSelected ? styles.selected : ''}`}
			>
				{value}
			</p>
		);
	};

	return BLOG_TAGS.map(render);
};
