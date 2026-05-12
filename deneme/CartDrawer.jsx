export default function Hero({ settings, status }) {
  const image = settings.defaultImageUrl;
  return (
    <section className="heroCard">
      <img src={image} alt="" />
      <div className="heroShade" />
      <div className="heroCopy">
        <span className={status.open ? "statusPill open" : "statusPill closed"}>{status.label}</span>
        <h1>{settings.restaurantName}</h1>
        <p>Pizza, kebab og burgere · {settings.city || "Skarnes"}</p>
      </div>
    </section>
  );
}
