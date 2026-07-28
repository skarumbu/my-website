// A wiki "page" is either a Package page (a specific deployable service) or a plain page
// describing a cross-cutting concept. There's no explicit type tag — a page IS a PackagePage
// if it happens to carry package-specific fields (repoUrl, techStack, pipeline). That's a
// checkable fact about the data, not a category a page has to declare itself into.

export interface PipelineStep {
  label: string;
  color?: 'blue' | 'green' | 'orange';
}

export interface FlowStep {
  label: string;
  sublines?: string[];
  color?: 'blue' | 'green' | 'orange' | 'purple';
}

export interface PageSection {
  heading: string;
  content: string;
}

export interface Page {
  key: string;
  title: string;
  role?: string;
  summary?: string;
  description: string;
  features?: string[];
  architecture?: { overview: string; keyPoints: string[] };
  sections?: PageSection[];
  relatedPages?: string[];
  updatedAt?: string;
  updatedBySha?: string;
  updatedByPackage?: string;
}

export interface PackagePage extends Page {
  runsOn: string;
  repoUrl: string;
  techStack: string[];
  pipeline: PipelineStep[];
  dataFlow?: FlowStep[];
}

export function isPackagePage(page: Page): page is PackagePage {
  return typeof (page as PackagePage).repoUrl === 'string';
}
