import { Redirect } from 'expo-router';

import { useStore } from '../src/store';

export default function Index() {
  const onboarded = useStore((s) => s.profile.onboarded);
  return <Redirect href={onboarded ? '/today' : '/onboarding'} />;
}
