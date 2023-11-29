const handleToggleClick = (e) => {
	const src = e.target.src;
	const isMoon = src.endsWith('moon.svg');
	//	处理显示图标
	e.target.setAttribute('src', isMoon ? '/sun.svg' : '/moon.svg');
	//	更新css主题
	const element = document.documentElement;
	element.classList.toggle('dark');
	//	切换 localStorage 的存储变量
	const isDark = element.classList.contains('dark');
	localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

document.addEventListener('astro:after-swap', () => {
	const theme = (() => {
		if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
			return localStorage.getItem('theme');
		}
		if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			return 'dark';
		}
		return 'light';
	})();

	const btnID = 'modeBtn';
	const btnElement = document.getElementById(btnID);

	if (btnElement === null || theme === null) {
		return;
	}

	if (theme === 'light') {
		btnElement.setAttribute('src', '/sun.svg');
		document.documentElement.classList.remove('dark');
	} else {
		btnElement.setAttribute('src', '/moon.svg');
		document.documentElement.classList.add('dark');
	}

	window.localStorage.setItem('theme', theme);

	document.getElementById('modeBtn').addEventListener('click', handleToggleClick);
});

document.addEventListener('astro:page-load', () => {
	document.getElementById('modeBtn').addEventListener('click', handleToggleClick);
});
