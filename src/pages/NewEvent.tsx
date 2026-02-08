import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const NewEvent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const date = searchParams.get('date');
    const target = date
      ? `/dashboard?createEvent=1&date=${encodeURIComponent(date)}`
      : '/dashboard?createEvent=1';
    navigate(target, { replace: true });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse-subtle">Opening event creator...</div>
    </div>
  );
};

export default NewEvent;
