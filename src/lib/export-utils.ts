import type { FacebookApiResult } from './facebook-api';

/**
 * Convert data to CSV format and trigger download
 */
function downloadCSV(data: string, filename: string) {
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSV(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export ads data to CSV
 */
export function exportAdsToCSV(result: FacebookApiResult) {
  const headers = [
    'Ad ID',
    'Ad Title',
    'Creative Body',
    'Started Running',
    'Days Running',
    'Is Active',
    'EU Total Reach',
    'Target Gender',
    'Target Age Min',
    'Target Age Max',
    'Beneficiary',
    'Payer',
    'Ad Library Link',
  ];

  const rows = result.ads.map(ad => {
    const daysRunning = ad.startedRunning
      ? Math.floor((new Date().getTime() - new Date(ad.startedRunning).getTime()) / (1000 * 60 * 60 * 24))
      : '';

    return [
      escapeCSV(ad.adArchiveId),
      escapeCSV(ad.linkTitle),
      escapeCSV(ad.creativeBody?.slice(0, 500)),
      escapeCSV(ad.startedRunning),
      escapeCSV(daysRunning),
      escapeCSV(ad.isActive ? 'Yes' : 'No'),
      escapeCSV(ad.euTotalReach),
      escapeCSV(ad.targeting.gender),
      escapeCSV(ad.targeting.ageMin),
      escapeCSV(ad.targeting.ageMax),
      escapeCSV(ad.beneficiary),
      escapeCSV(ad.payer),
      escapeCSV(`https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const pageName = result.pageName?.replace(/[^a-zA-Z0-9]/g, '_') || 'ads';
  downloadCSV(csv, `${pageName}_ads_${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * Export demographics data to CSV
 */
export function exportDemographicsToCSV(result: FacebookApiResult) {
  if (!result.aggregatedDemographics) return;

  const demo = result.aggregatedDemographics;
  const pageName = result.pageName?.replace(/[^a-zA-Z0-9]/g, '_') || 'demographics';

  // Gender breakdown
  const genderHeaders = ['Gender', 'Percentage'];
  const genderRows = demo.genderBreakdown.map(g =>
    [escapeCSV(g.gender), escapeCSV(g.percentage.toFixed(2))].join(',')
  );

  // Age breakdown
  const ageHeaders = ['Age Group', 'Percentage'];
  const ageRows = demo.ageBreakdown.map(a =>
    [escapeCSV(a.age), escapeCSV(a.percentage.toFixed(2))].join(',')
  );

  // Region breakdown
  const regionHeaders = ['Country', 'Percentage'];
  const regionRows = demo.regionBreakdown.map(r =>
    [escapeCSV(r.region), escapeCSV(r.percentage.toFixed(2))].join(',')
  );

  // Age-Gender combined
  const ageGenderHeaders = ['Age Group', 'Gender', 'Percentage'];
  const ageGenderRows = demo.ageGenderBreakdown.map(ag =>
    [escapeCSV(ag.age), escapeCSV(ag.gender), escapeCSV(ag.percentage.toFixed(2))].join(',')
  );

  const csv = [
    '# Demographics Summary',
    `# Page: ${result.pageName || 'Unknown'}`,
    `# Ads Analyzed: ${demo.adsWithDemographics}`,
    `# Total Reach: ${demo.totalReachAnalyzed?.toLocaleString() || 'N/A'}`,
    `# Export Date: ${new Date().toISOString()}`,
    '',
    '## Gender Breakdown',
    genderHeaders.join(','),
    ...genderRows,
    '',
    '## Age Breakdown',
    ageHeaders.join(','),
    ...ageRows,
    '',
    '## Country Breakdown',
    regionHeaders.join(','),
    ...regionRows,
    '',
    '## Age-Gender Combined',
    ageGenderHeaders.join(','),
    ...ageGenderRows,
  ].join('\n');

  downloadCSV(csv, `${pageName}_demographics_${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * Export complete report to CSV
 */
export function exportFullReportToCSV(result: FacebookApiResult) {
  const pageName = result.pageName?.replace(/[^a-zA-Z0-9]/g, '_') || 'report';
  const demo = result.aggregatedDemographics;

  const sections: string[] = [
    '# Facebook Ad Library Analysis Report',
    `# Page: ${result.pageName || 'Unknown'}`,
    `# Page ID: ${result.pageId}`,
    `# Total Ads: ${result.totalAdsFound}`,
    `# Export Date: ${new Date().toISOString()}`,
    '',
  ];

  // Summary stats
  const totalReach = result.ads.reduce((sum, ad) => sum + ad.euTotalReach, 0);
  const activeAds = result.ads.filter(ad => ad.isActive).length;
  const avgReach = result.ads.length > 0 ? Math.round(totalReach / result.ads.length) : 0;

  sections.push(
    '## Summary',
    'Metric,Value',
    `Total Ads,${result.totalAdsFound}`,
    `Active Ads,${activeAds}`,
    `Total EU Reach,${totalReach.toLocaleString()}`,
    `Average Reach per Ad,${avgReach.toLocaleString()}`,
    ''
  );

  // Demographics if available
  if (demo) {
    sections.push(
      '## Demographics - Gender',
      'Gender,Percentage',
      ...demo.genderBreakdown.map(g => `${g.gender},${g.percentage.toFixed(2)}`),
      '',
      '## Demographics - Age',
      'Age Group,Percentage',
      ...demo.ageBreakdown.map(a => `${a.age},${a.percentage.toFixed(2)}`),
      '',
      '## Demographics - Country',
      'Country,Percentage',
      ...demo.regionBreakdown.map(r => `${r.region},${r.percentage.toFixed(2)}`),
      ''
    );
  }

  // Media type if available
  if (result.mediaTypeBreakdown) {
    const mtb = result.mediaTypeBreakdown;
    sections.push(
      '## Media Type Breakdown',
      'Type,Count,Percentage',
      `Video,${mtb.video},${mtb.videoPercentage.toFixed(2)}`,
      `Image,${mtb.image},${mtb.imagePercentage.toFixed(2)}`,
      ''
    );
  }

  // Ads list
  sections.push(
    '## All Ads',
    'Ad ID,Title,Creative Body,Started Running,Days Running,Is Active,EU Reach,Gender Target,Age Min,Age Max,Ad Library Link'
  );

  result.ads.forEach(ad => {
    const daysRunning = ad.startedRunning
      ? Math.floor((new Date().getTime() - new Date(ad.startedRunning).getTime()) / (1000 * 60 * 60 * 24))
      : '';

    sections.push([
      escapeCSV(ad.adArchiveId),
      escapeCSV(ad.linkTitle),
      escapeCSV(ad.creativeBody?.slice(0, 200)),
      escapeCSV(ad.startedRunning),
      escapeCSV(daysRunning),
      escapeCSV(ad.isActive ? 'Yes' : 'No'),
      escapeCSV(ad.euTotalReach),
      escapeCSV(ad.targeting.gender),
      escapeCSV(ad.targeting.ageMin),
      escapeCSV(ad.targeting.ageMax),
      escapeCSV(`https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`),
    ].join(','));
  });

  downloadCSV(sections.join('\n'), `${pageName}_full_report_${new Date().toISOString().split('T')[0]}.csv`);
}
