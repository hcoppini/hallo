import type { Metadata } from 'next';
import { ProjectorDisplay } from '@/components/ProjectorDisplay';

export const metadata: Metadata = {
  title: 'PROJECTOR // YouTube Visualizer & Live Guest Arrivals',
  description: 'Widescreen projector station displaying YouTube music video visualizer alongside real-time live guest admissions.',
};

export default function ProjectorPage() {
  return <ProjectorDisplay />;
}
