'use strict';

const puppeteer = require('puppeteer');
const prompts = require('./prompts');
let page;

const { EMAIL, PASSWORD } = process.env

async function main() {

  const answers = await prompts();

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100
  });
  page = await browser.newPage();

  await page.goto('https://mbasic.facebook.com/');
  await page.$eval('input[id=m_login_email]', (el, user) => el.value = user, EMAIL || answers.username);
  await page.$eval('input[name=pass]', ((el, pass) => el.value = pass), PASSWORD || answers.password);
  await page.$eval('input[name=login]', button => button.click());
  await page.goto('https://mbasic.facebook.com/');

  await next(answers.categories, answers.years);
}

async function goToFilters() {
  await followLinkByContent('Profile');
  await followLinkByContent('Activity Log');
  await followLinkByContent('Filter');
}

async function visitCategory (category) {
  try {
    await followLinkByContent(category);
  } catch (e) {
    console.log('Error trying again from filters page', e);
    await page.goto('https://mbasic.facebook.com/');
    await goToFilters();
    await followLinkByContent(category);
  }
}

async function next(categories, years) {
  await goToFilters()

  for (const i in categories) {
    const category = categories[i]
    console.log("Deleting category " + category);
    await visitCategory(category)
    for (const j in years) {
      console.log("In year " + years[j]);
      try {
        await followLinkByContent(years[j]);
        await deleteYear(years[j]);
      } catch(e) {
        console.log(`Year ${years[j]} not found.`, e);
      }
    }
    await visitCategory(category)
  }

  await page.close();
  console.log("Done!");
  process.exit();
}

async function deletePosts() {
  // get all "allactivity/delete", "allactivity/removecontent", and allactivity/visibility links on page
  const deleteLinks = await page.evaluate(() => {
    const links = [];
    const deleteElements = document.querySelectorAll('a[href*="allactivity/delete"]');
    const removeElements = document.querySelectorAll('a[href*="allactivity/removecontent"]');
    const hideElements = document.querySelectorAll('a[href*="allactivity/visibility"]');

    for (const el of deleteElements) {
        links.push(el.href);
    }
    for (const el of removeElements) {
        links.push(el.href);
    }
    for (const el of hideElements) {
        if (el.innerText.includes('Hide')) {
          links.push(el.href);
        }
    }
    return links;
  });
  // visit them all to delete content
  for (let i = 0; i < deleteLinks.length; i++) {
      await page.goto(deleteLinks[i]);
  }
}


async function getMonthLinks(year) {
  const monthLinks = await page.evaluate((year) => {
    const months = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const links = [];
    const elements = document.querySelectorAll('a');
    for (const el of elements) {
      for (let i = 0; i < months.length; i++) {
        if (months[i] + " " + year === el.innerText) {
          links.push(el.href);
        }
      }
    }
    return links;
  }, year);
  return monthLinks;
}

async function followLinkByContent(content) {
  const link = await page.evaluate((text) => {
    console.log(text)
    const aTags = document.querySelectorAll('a');
    for (let aTag of aTags) {
      if (aTag.innerText === text) {
        return aTag.href;
      }
    }
  }, content);
  await page.goto(link);
}

async function deleteYear(year) {
  const monLinks = await getMonthLinks(year);
  for (const mon in monLinks) {
    // console.log("Deleting month: ", monLinks[mon]);
    await page.goto(monLinks[mon]);
    await deletePosts();
  }
}

main();
