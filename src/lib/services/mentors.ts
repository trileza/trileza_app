import { nexus } from '../nexus';

export type MentorTier = 'provisional' | 'basic' | 'standard' | 'full';

export interface VerificationResult {
  score: number;
  tier: MentorTier;
  detectedData: {
    name?: string;
    title?: string;
    photoUrl?: string;
    stats?: string;
  };
}

export const mentorService = {
  /**
   * The "Nexus" Verification Engine
   * Instantly analyzes a link and determines the mentor tier.
   */
  async verifyMentor(userId: string, category: string, proofLink: string): Promise<VerificationResult> {
    const { data, error } = await nexus.functions.invoke('mentor-verify', {
      body: { category, proofLink, userId }
    });

    if (error) {
      console.error('Verification Engine Error:', error);
      throw new Error('The Nexus grid is currently unavailable. Please try again.');
    }

    return {
      score: data.score,
      tier: data.tier,
      detectedData: data.detectedData
    };
  }
};
