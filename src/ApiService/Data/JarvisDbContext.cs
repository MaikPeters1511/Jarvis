using ApiService.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ApiService.Data;

public class JarvisDbContext(DbContextOptions<JarvisDbContext> options) : DbContext(options)
{
    public DbSet<ReferenceVoice> Voices => Set<ReferenceVoice>();
    public DbSet<JarvisSetting> Settings => Set<JarvisSetting>();
    public DbSet<ChatLog> ChatLogs => Set<ChatLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ReferenceVoice>(e =>
        {
            e.HasIndex(v => v.Name);
            e.Property(v => v.CreatedAt).HasDefaultValueSql("now() at time zone 'utc'");
        });

        modelBuilder.Entity<JarvisSetting>(e =>
        {
            e.HasKey(s => s.Key);
        });

        modelBuilder.Entity<ChatLog>(e =>
        {
            e.HasIndex(l => l.CreatedAt);
            e.Property(l => l.CreatedAt).HasDefaultValueSql("now() at time zone 'utc'");
        });
    }
}
