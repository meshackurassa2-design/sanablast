export const Skeleton = ({ width, height, borderRadius, style = {} }) => (
  <div
    className="skeleton-loader"
    style={{
      width: width || '100%',
      height: height || '20px',
      borderRadius: borderRadius || '4px',
      ...style,
    }}
  />
);

export const ProfileSkeleton = () => (
  <div style={{ background: '#fff', minHeight: '100dvh' }}>
    {/* Cover image skeleton */}
    <Skeleton height="160px" borderRadius="0" />
    
    <div style={{ padding: '0 16px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '-48px', left: '16px' }}>
        <Skeleton width="88px" height="88px" borderRadius="50%" style={{ border: '4px solid #fff' }} />
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '14px', marginBottom: '58px' }}>
        <Skeleton width="110px" height="34px" borderRadius="20px" />
      </div>
      
      <Skeleton width="180px" height="24px" style={{ marginBottom: '8px' }} />
      <Skeleton width="120px" height="16px" style={{ marginBottom: '16px' }} />
      
      <Skeleton width="80%" height="14px" style={{ marginBottom: '6px' }} />
      <Skeleton width="60%" height="14px" style={{ marginBottom: '16px' }} />
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <Skeleton width="80px" height="14px" />
        <Skeleton width="80px" height="14px" />
      </div>
    </div>
    
    <div style={{ display: 'flex', borderBottom: '1px solid #eff3f4', marginTop: '16px', paddingBottom: '14px' }}>
      <Skeleton width="60px" height="16px" style={{ flex: 1, margin: '0 20px' }} />
      <Skeleton width="60px" height="16px" style={{ flex: 1, margin: '0 20px' }} />
      <Skeleton width="60px" height="16px" style={{ flex: 1, margin: '0 20px' }} />
    </div>
    
    <FeedSkeleton count={3} />
  </div>
);

export const FeedSkeleton = ({ count = 5 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid #eff3f4', display: 'flex', gap: '12px' }}>
        <Skeleton width="42px" height="42px" borderRadius="50%" />
        <div style={{ flex: 1 }}>
          <Skeleton width="140px" height="16px" style={{ marginBottom: '8px' }} />
          <Skeleton width="90%" height="14px" style={{ marginBottom: '6px' }} />
          <Skeleton width="70%" height="14px" style={{ marginBottom: '16px' }} />
          <div style={{ display: 'flex', gap: '28px' }}>
            <Skeleton width="20px" height="14px" />
            <Skeleton width="20px" height="14px" />
            <Skeleton width="20px" height="14px" />
          </div>
        </div>
      </div>
    ))}
  </>
);

export const MessageSkeleton = ({ count = 6 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{ display: 'flex', gap: '12px', padding: '14px 20px', borderBottom: '1px solid #eff3f4' }}>
        <Skeleton width="48px" height="48px" borderRadius="50%" />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <Skeleton width="120px" height="15px" />
            <Skeleton width="40px" height="12px" />
          </div>
          <Skeleton width="80%" height="14px" />
        </div>
      </div>
    ))}
  </>
);
