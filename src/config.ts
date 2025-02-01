import type { Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://github.com/vanyongqi/", // replace this with your deployed domain
  author: "Vanyongqi",
  profile: "https://github.com/vanyongqi",
  desc: "yongqi‘s博客",
  title: "Yongqi‘s Blog💤",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 3,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  editPost: {
    url: "https://github.com/satnaing/astro-paper/edit/main/src/content/blog",
    text: "Suggest Changes",
    appendFilePath: true,
  },
};

export const LOCALE = {
  lang: "en", // html lang code. Set this empty and default will be "en"
  langTag: ["en-EN"], // BCP 47 Language Tags. Set this empty [] to use the environment default
} as const;

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/vanyongqi",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:vanyongqi@gmail.com",
    linkTitle: `Send an email to ${SITE.title}`,
    active: true,
  },
  {
    name: "GitLab",
    href: "https://github.com/vanyongqi",
    linkTitle: `${SITE.title} on GitLab`,
    active: true,
  },
  {
    name: "Wechat",
    href: "fyongqi7",
    linkTitle: `查看 StackOverflow 上关于 ${SITE.title} 的问题`,
    active: true,
  },
];
